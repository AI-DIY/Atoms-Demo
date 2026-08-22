import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as startRun } from "@/app/api/projects/[projectId]/runs/route";
import { POST as approveRun } from "@/app/api/projects/[projectId]/runs/[runId]/approve/route";
import { createProject, getProject } from "@/lib/repository";
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
});
