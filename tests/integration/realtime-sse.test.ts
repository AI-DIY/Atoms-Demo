import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";
import { POST as approveRun } from "@/app/api/projects/[projectId]/runs/[runId]/approve/route";
import { POST as startRun } from "@/app/api/projects/[projectId]/runs/route";
import {
  createProject,
  createRun,
} from "@/lib/repository";
import { prisma } from "@/server/prisma";

const getAgentProvider = vi.hoisted(() => vi.fn());

vi.mock("@/lib/env", () => ({ getAgentProvider }));

function deferred() {
  let resolve!: () => void;
  const promise = new Promise<void>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

class DelayedFirstResponseProvider implements AgentProvider {
  private readonly delegate = new MockProvider();
  private readonly firstGenerate = deferred();
  private readonly releaseFirstGenerate = deferred();
  private delayed = false;

  async generate(role: Parameters<AgentProvider["generate"]>[0], context: AgentContext): Promise<AgentOutput> {
    if (!this.delayed) {
      this.delayed = true;
      this.firstGenerate.resolve();
      await this.releaseFirstGenerate.promise;
    }

    return this.delegate.generate(role, context);
  }

  waitForFirstGenerate() {
    return this.firstGenerate.promise;
  }

  release() {
    this.releaseFirstGenerate.resolve();
  }
}

async function readChunk(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const chunk = await reader.read();

  expect(chunk.done).toBe(false);
  return new TextDecoder().decode(chunk.value);
}

async function readRemaining(reader: ReadableStreamDefaultReader<Uint8Array>) {
  const decoder = new TextDecoder();
  let events = "";

  while (true) {
    const chunk = await reader.read();

    if (chunk.done) {
      return events + decoder.decode();
    }

    events += decoder.decode(chunk.value, { stream: true });
  }
}

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

describe("realtime run event streams", () => {
  beforeEach(async () => {
    getAgentProvider.mockReset();
    await prisma.appVersion.deleteMany();
    await prisma.runStep.deleteMany();
    await prisma.run.deleteMany();
    await prisma.message.deleteMany();
    await prisma.project.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("streams run and step starts before the plan provider resolves", async () => {
    const provider = new DelayedFirstResponseProvider();
    getAgentProvider.mockReturnValue(provider);
    const project = await createProject({
      title: "实时计划测试",
      goal: "为摄影师创建预约与报价工具",
    });
    let response: Response | undefined;
    const responsePromise = startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-project-token": project.ownerToken,
        },
        body: JSON.stringify({ mode: "team", request: project.goal }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    ).then((nextResponse) => {
      response = nextResponse;
      return nextResponse;
    });

    await provider.waitForFirstGenerate();
    await Promise.resolve();

    expect(response).toBeDefined();
    expect(response?.headers.get("content-type")).toContain("text/event-stream");
    const reader = response!.body!.getReader();
    const earlyEvents = `${await readChunk(reader)}${await readChunk(reader)}`;

    expect(earlyEvents).toContain("event: run.started");
    expect(earlyEvents).toContain("event: step.started");
    expect(earlyEvents).not.toContain("event: step.completed");

    provider.release();
    const completedEvents = await readRemaining(reader);

    expect(completedEvents).toContain("event: step.completed");
    expect(completedEvents).toContain("event: run.awaiting_approval");
    await responsePromise;
  });

  it("streams run and step starts before the approval build provider resolves", async () => {
    const provider = new DelayedFirstResponseProvider();
    getAgentProvider.mockReturnValue(provider);
    const project = await createProject({
      title: "实时审批测试",
      goal: "为摄影师创建预约与报价工具",
    });
    const run = await createRun(project.id, project.ownerToken, {
      mode: "team",
      status: "awaiting_approval",
      planJson: plannedRunJson(project.goal),
    });
    let response: Response | undefined;
    const responsePromise = approveRun(
      new Request(`http://localhost/api/projects/${project.id}/runs/${run.id}/approve`, {
        method: "POST",
        headers: { "x-project-token": project.ownerToken },
      }),
      { params: Promise.resolve({ projectId: project.id, runId: run.id }) },
    ).then((nextResponse) => {
      response = nextResponse;
      return nextResponse;
    });

    await provider.waitForFirstGenerate();
    await Promise.resolve();

    expect(response).toBeDefined();
    expect(response?.headers.get("content-type")).toContain("text/event-stream");
    const reader = response!.body!.getReader();
    const earlyEvents = `${await readChunk(reader)}${await readChunk(reader)}`;

    expect(earlyEvents).toContain("event: run.started");
    expect(earlyEvents).toContain("event: step.started");
    expect(earlyEvents).not.toContain("event: step.completed");

    provider.release();
    const completedEvents = await readRemaining(reader);

    expect(completedEvents).toContain("event: step.completed");
    expect(completedEvents).toContain("event: run.completed");
    await responsePromise;
  });
});
