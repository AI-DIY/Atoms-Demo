import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import { POST as approveRun } from "@/app/api/projects/[projectId]/runs/[runId]/approve/route";
import { POST as startRun } from "@/app/api/projects/[projectId]/runs/route";
import {
  resetExecutionLimitsForTests,
  specialistGenerationGate,
  teamGenerationGate,
} from "@/lib/execution-limits";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";
import { createProject, createRun, getProject } from "@/lib/repository";
import { maxRunRequestBytes } from "@/lib/run-input";
import { prisma } from "@/server/prisma";

const getAgentProvider = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ getAgentProvider }));

function plannedRunJson(goal: string) {
  return JSON.stringify({
    goal,
    artifact: {
      type: "plan",
      content: {
        roles: ["pm", "architect", "engineer"],
        risks: ["需要人工确认核心业务流程后再开始构建"],
      },
    },
  });
}

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });
  return { promise, resolve };
}

class DelayedProvider implements AgentProvider {
  private readonly delegate = new MockProvider();
  private readonly started = deferred();
  private readonly releaseFirst = deferred();
  private delayed = false;

  async generate(role: Parameters<AgentProvider["generate"]>[0], context: AgentContext): Promise<AgentOutput> {
    if (!this.delayed) {
      this.delayed = true;
      this.started.resolve();
      await this.releaseFirst.promise;
    }
    return this.delegate.generate(role, context);
  }

  waitForStart() {
    return this.started.promise;
  }

  release() {
    this.releaseFirst.resolve();
  }
}

function runRequest(projectId: string, ownerToken: string, ip: string, mode = "mention") {
  return new Request(`http://localhost/api/projects/${projectId}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-project-token": ownerToken,
      "x-forwarded-for": ip,
    },
    body: JSON.stringify({ mode, request: mode === "mention" ? "@研究员 分析目标用户" : "制定项目计划" }),
  });
}

describe("execution limits", () => {
  beforeEach(async () => {
    resetExecutionLimitsForTests();
    getAgentProvider.mockReset();
    getAgentProvider.mockReturnValue(new MockProvider());
    await prisma.appVersion.deleteMany();
    await prisma.runStep.deleteMany();
    await prisma.run.deleteMany();
    await prisma.message.deleteMany();
    await prisma.project.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("rejects the sixth model start for the same IP", async () => {
    const project = await createProject({ title: "限流测试", goal: "为摄影师创建预约与报价工具" });

    for (let index = 0; index < 5; index += 1) {
      const response = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.10"), {
        params: Promise.resolve({ projectId: project.id }),
      });
      await response.text();
      expect(response.status).toBe(200);
    }

    const rejected = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.10"), {
      params: Promise.resolve({ projectId: project.id }),
    });

    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toEqual({ error: "请求过于频繁，请稍后重试。" });
  });

  it("rejects a run request whose declared content length exceeds the safety limit before starting a model", async () => {
    const project = await createProject({ title: "请求体上限测试", goal: "为摄影师创建预约与报价工具" });
    const response = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(maxRunRequestBytes + 1),
          "x-project-token": project.ownerToken,
          "x-forwarded-for": "198.51.100.16",
        },
        body: JSON.stringify({ mode: "team", request: "x".repeat(9_000) }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Request body too large" });
    expect(getAgentProvider).not.toHaveBeenCalled();
    await expect(getProject(project.id, project.ownerToken)).resolves.toMatchObject({ runs: [] });
  });

  it("rejects a chunked oversized run request before starting a model", async () => {
    const project = await createProject({ title: "分块请求体测试", goal: "为摄影师创建预约与报价工具" });
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maxRunRequestBytes));
        controller.enqueue(new Uint8Array([0]));
        controller.close();
      },
    });
    const request = new Request(`http://localhost/api/projects/${project.id}/runs`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-project-token": project.ownerToken,
        "x-forwarded-for": "198.51.100.17",
      },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect(request.headers.get("content-length")).toBeNull();

    const response = await startRun(request, {
      params: Promise.resolve({ projectId: project.id }),
    });

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Request body too large" });
    expect(getAgentProvider).not.toHaveBeenCalled();
    await expect(getProject(project.id, project.ownerToken)).resolves.toMatchObject({ runs: [] });
  });

  it("counts approvals in the same IP model-start window", async () => {
    const project = await createProject({ title: "审批限流测试", goal: "为摄影师创建预约与报价工具" });
    const run = await createRun(project.id, project.ownerToken, {
      mode: "team",
      status: "awaiting_approval",
      planJson: plannedRunJson(project.goal),
    });
    const ip = "198.51.100.15";

    for (let index = 0; index < 5; index += 1) {
      const response = await startRun(runRequest(project.id, project.ownerToken, ip), {
        params: Promise.resolve({ projectId: project.id }),
      });
      await response.text();
    }

    const rejected = await approveRun(
      new Request(`http://localhost/api/projects/${project.id}/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "x-project-token": project.ownerToken, "x-forwarded-for": ip },
      }),
      { params: Promise.resolve({ projectId: project.id, runId: run.id }) },
    );

    expect(rejected.status).toBe(429);
    const loaded = await getProject(project.id, project.ownerToken);
    expect(loaded.runs.find((storedRun) => storedRun.id === run.id)).toMatchObject({
      status: "awaiting_approval",
    });
  });

  it("uses the specialist gate for mentions", async () => {
    const project = await createProject({ title: "并发测试", goal: "为摄影师创建预约与报价工具" });
    const release = await specialistGenerationGate.acquire();
    const secondRelease = await specialistGenerationGate.acquire();

    try {
      const response = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.11"), {
        params: Promise.resolve({ projectId: project.id }),
      });

      expect(response.status).toBe(503);
      await expect(response.json()).resolves.toEqual({ error: "服务器正忙，请稍后重试。" });
    } finally {
      release();
      secondRelease();
    }
  });

  it("does not claim an approval when the team gate is busy", async () => {
    const project = await createProject({ title: "审批并发测试", goal: "为摄影师创建预约与报价工具" });
    const run = await createRun(project.id, project.ownerToken, {
      mode: "team",
      status: "awaiting_approval",
      planJson: plannedRunJson(project.goal),
    });
    const release = await teamGenerationGate.acquire();
    const request = () => new Request(
      `http://localhost/api/projects/${project.id}/runs/${run.id}/approve`,
      { method: "POST", headers: { "x-project-token": project.ownerToken, "x-forwarded-for": "198.51.100.12" } },
    );

    try {
      const busy = await approveRun(request(), {
        params: Promise.resolve({ projectId: project.id, runId: run.id }),
      });
      expect(busy.status).toBe(503);
    } finally {
      release();
    }

    const accepted = await approveRun(request(), {
      params: Promise.resolve({ projectId: project.id, runId: run.id }),
    });
    expect(accepted.status).toBe(200);
    await accepted.text();

    await expect(getProject(project.id, project.ownerToken)).resolves.toMatchObject({ status: "ready" });
  });

  it("keeps the team gate occupied after SSE cancellation until the producer completes", async () => {
    const provider = new DelayedProvider();
    getAgentProvider.mockReturnValue(provider);
    const project = await createProject({ title: "取消连接测试", goal: "为摄影师创建预约与报价工具" });
    const context = { params: Promise.resolve({ projectId: project.id }) };
    const first = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.13", "team"), context);

    await provider.waitForStart();
    const reader = first.body!.getReader();
    await reader.read();
    await reader.cancel();

    const busy = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.14", "team"), context);
    expect(busy.status).toBe(503);

    provider.release();
    await vi.waitFor(async () => {
      await expect(getProject(project.id, project.ownerToken)).resolves.toMatchObject({ status: "ready" });
    });

    const next = await startRun(runRequest(project.id, project.ownerToken, "198.51.100.14", "team"), context);
    expect(next.status).toBe(200);
    await next.text();
  });
});
