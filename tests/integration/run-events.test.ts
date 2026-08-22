import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as startRun } from "@/app/api/projects/[projectId]/runs/route";
import { POST as approveRun } from "@/app/api/projects/[projectId]/runs/[runId]/approve/route";
import {
  createProject,
  createVersion,
  getProject,
  updateProjectStatus,
} from "@/lib/repository";
import { prisma } from "@/server/prisma";

async function readStream(response: Response): Promise<string> {
  return response.text();
}

describe("persistent run events", () => {
  beforeEach(async () => {
    await prisma.appVersion.deleteMany();
    await prisma.runStep.deleteMany();
    await prisma.run.deleteMany();
    await prisma.message.deleteMany();
    await prisma.project.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stops a team run at approval and builds only after explicit approval", async () => {
    const project = await createProject({
      title: "摄影预约助手",
      goal: "为摄影师创建预约与报价工具",
    });
    const headers = { "x-project-token": project.ownerToken, "content-type": "application/json" };

    const planResponse = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers,
        body: JSON.stringify({ mode: "team", request: project.goal }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const planEvents = await readStream(planResponse);
    const planned = await getProject(project.id, project.ownerToken);
    const plannedRun = planned.runs[0];

    expect(planResponse.headers.get("content-type")).toContain("text/event-stream");
    expect(planEvents).toMatch(
      /event: run\.started[\s\S]*event: step\.started[\s\S]*event: step\.completed[\s\S]*event: run\.awaiting_approval/u,
    );
    expect(planEvents).toContain("event: run.awaiting_approval");
    expect(planned.status).toBe("awaiting_approval");
    expect(plannedRun.steps).toHaveLength(1);
    expect(planned.versions).toHaveLength(0);

    const buildResponse = await approveRun(
      new Request(`http://localhost/api/projects/${project.id}/runs/${plannedRun.id}/approve`, {
        method: "POST",
        headers: { "x-project-token": project.ownerToken },
      }),
      { params: Promise.resolve({ projectId: project.id, runId: plannedRun.id }) },
    );
    const buildEvents = await readStream(buildResponse);
    const built = await getProject(project.id, project.ownerToken);

    expect(buildEvents).toContain("event: run.completed");
    expect(buildEvents).toMatch(
      /role":"pm"[\s\S]*role":"architect"[\s\S]*role":"engineer"[\s\S]*role":"reviewer"[\s\S]*event: run\.completed/u,
    );
    expect(built.status).toBe("ready");
    expect(built.runs[0]?.steps.map((step) => step.role)).toEqual([
      "leader",
      "pm",
      "architect",
      "engineer",
      "reviewer",
    ]);
    expect(built.versions).toHaveLength(1);
    expect(built.currentVersion).toBe(1);

    const repeatedApproval = await approveRun(
      new Request(`http://localhost/api/projects/${project.id}/runs/${plannedRun.id}/approve`, {
        method: "POST",
        headers: { "x-project-token": project.ownerToken },
      }),
      { params: Promise.resolve({ projectId: project.id, runId: plannedRun.id }) },
    );

    expect(repeatedApproval.status).toBe(409);
  });

  it("rejects invalid run input and hides a project from a non-owner", async () => {
    const project = await createProject({
      title: "摄影预约助手",
      goal: "为摄影师创建预约与报价工具",
    });

    const invalidResponse = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "x-project-token": project.ownerToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "team", request: "" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const hiddenResponse = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "x-project-token": "wrong-token",
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "team", request: project.goal }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );

    expect(invalidResponse.status).toBe(400);
    expect(hiddenResponse.status).toBe(404);
    expect((await getProject(project.id, project.ownerToken)).runs).toHaveLength(0);
  });

  it("routes a mention to only the requested specialist without changing the app", async () => {
    const project = await createProject({
      title: "摄影预约助手",
      goal: "为摄影师创建预约与报价工具",
    });
    await createVersion(project.id, project.ownerToken, {
      title: "预约工具",
      html: "<!doctype html><html><body>current app</body></html>",
    });
    await updateProjectStatus(project.id, project.ownerToken, "ready");

    const response = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "x-project-token": project.ownerToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "mention", request: "@研究员 请分析目标用户" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const events = await readStream(response);
    const loaded = await getProject(project.id, project.ownerToken);

    expect(response.status).toBe(200);
    expect(events).toMatch(
      /event: run\.started[\s\S]*role":"research"[\s\S]*event: step\.completed[\s\S]*event: run\.completed/u,
    );
    expect(events).toContain('"summary":"已整理“为摄影师创建预约与报价工具”的初步研究假设。"');
    expect(events).not.toContain('"versionId"');
    expect(loaded.status).toBe("ready");
    expect(loaded.currentVersion).toBe(1);
    expect(loaded.versions).toHaveLength(1);
    expect(loaded.runs[0]).toMatchObject({ mode: "mention", status: "completed" });
    expect(loaded.runs[0]?.steps.map((step) => step.role)).toEqual(["research"]);
  });

  it("iterates a ready app by calling only Engineer and creating V2", async () => {
    const project = await createProject({
      title: "摄影预约助手",
      goal: "为摄影师创建预约与报价工具",
    });
    await createVersion(project.id, project.ownerToken, {
      title: "预约工具",
      html: "<!doctype html><html><body>current app</body></html>",
    });
    await updateProjectStatus(project.id, project.ownerToken, "ready");

    const response = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "x-project-token": project.ownerToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "iterate", request: "将预约表单改成双列布局" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );
    const events = await readStream(response);
    const loaded = await getProject(project.id, project.ownerToken);

    expect(response.status).toBe(200);
    expect(events).toMatch(/role":"engineer"[\s\S]*event: run\.completed/u);
    expect(events).not.toMatch(/role":"(?:leader|pm|architect)"/u);
    expect(events).toContain('"versionId"');
    expect(loaded.status).toBe("ready");
    expect(loaded.currentVersion).toBe(2);
    expect(loaded.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(loaded.runs[0]).toMatchObject({ mode: "iterate", status: "completed" });
    expect(loaded.runs[0]?.steps.map((step) => step.role)).toEqual(["engineer"]);
  });

  it("rejects iteration without an available current version before creating a run", async () => {
    const project = await createProject({
      title: "损坏版本项目",
      goal: "不应在缺失当前版本时开始迭代",
    });
    await prisma.project.update({
      where: { id: project.id },
      data: { status: "ready", currentVersion: 1 },
    });

    const response = await startRun(
      new Request(`http://localhost/api/projects/${project.id}/runs`, {
        method: "POST",
        headers: {
          "x-project-token": project.ownerToken,
          "content-type": "application/json",
        },
        body: JSON.stringify({ mode: "iterate", request: "调整页面布局" }),
      }),
      { params: Promise.resolve({ projectId: project.id }) },
    );

    expect(response.status).toBe(409);
    expect((await getProject(project.id, project.ownerToken)).runs).toHaveLength(0);
  });
});
