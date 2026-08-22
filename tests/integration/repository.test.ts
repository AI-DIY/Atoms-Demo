import { randomUUID } from "node:crypto";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "@/server/prisma";
import {
  appendMessage,
  completeRun,
  createProject,
  createRun,
  createRunStep,
  createVersion,
  getProject,
  restoreVersion,
} from "@/lib/repository";

describe("project repository", () => {
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

  it("runs against the dedicated test database", () => {
    expect(process.env.DATABASE_URL).toBe("file:./test.db");
  });

  it("persists a project behind its opaque owner token", async () => {
    const created = await createProject({
      title: "摄影预约助手",
      goal: "为摄影师创建预约与报价工具",
    });

    const loaded = await getProject(created.id, created.ownerToken);

    expect(created.ownerToken).toEqual(expect.any(String));
    expect(loaded.title).toBe("摄影预约助手");
    expect(loaded.currentVersion).toBe(0);
    expect(loaded).not.toHaveProperty("ownerToken");
  });

  it("allocates consecutive versions for concurrent writes", async () => {
    const project = await createProject({
      title: "并发版本测试",
      goal: "创建一个可交互的预约工具",
    });

    await Promise.all([
      createVersion(project.id, project.ownerToken, {
        title: "V1",
        html: "<!doctype html><html><body>v1</body></html>",
      }),
      createVersion(project.id, project.ownerToken, {
        title: "V2",
        html: "<!doctype html><html><body>v2</body></html>",
      }),
    ]);

    const loaded = await getProject(project.id, project.ownerToken);

    expect(loaded.versions.map((version) => version.version)).toEqual([1, 2]);
    expect(loaded.currentVersion).toBe(2);
  });

  it("restores an existing version without deleting history", async () => {
    const project = await createProject({
      title: "版本测试",
      goal: "创建一个可交互的预约工具",
    });
    const first = await createVersion(project.id, project.ownerToken, {
      title: "V1",
      html: "<!doctype html><html><body>v1</body></html>",
    });
    await createVersion(project.id, project.ownerToken, {
      title: "V2",
      html: "<!doctype html><html><body>v2</body></html>",
    });
    const beforeRestore = await getProject(project.id, project.ownerToken);

    const restored = await restoreVersion(project.id, project.ownerToken, first.id);
    const loaded = await getProject(project.id, project.ownerToken);

    expect(beforeRestore.currentVersion).toBe(2);
    expect(restored.version).toBe(1);
    expect(loaded.currentVersion).toBe(1);
    expect(loaded.versions).toHaveLength(2);
    expect(loaded.status).toBe("draft");
  });

  it("hides a nonexistent project from both reads and writes", async () => {
    const missingProjectId = randomUUID();
    const ownerToken = randomUUID();

    await expect(getProject(missingProjectId, ownerToken)).rejects.toThrow(
      "Project not found",
    );
    await expect(
      appendMessage(missingProjectId, ownerToken, {
        role: "leader",
        kind: "assistant",
        content: "不可写入",
      }),
    ).rejects.toThrow("Project not found");
  });

  it("persists messages and a completed run only for the project owner", async () => {
    const project = await createProject({
      title: "运行测试",
      goal: "创建一个可交互的预约工具",
    });

    await appendMessage(project.id, project.ownerToken, {
      role: "leader",
      kind: "assistant",
      content: "我会先制定团队计划。",
      mention: "负责人",
    });
    const run = await createRun(project.id, project.ownerToken, {
      mode: "team",
      status: "running",
      planJson: '{"roles":["pm","architect","engineer"]}',
    });
    await createRunStep(project.id, project.ownerToken, run.id, {
      role: "leader",
      status: "completed",
      inputSummary: "摄影预约工具目标",
      artifactType: "plan",
      artifactJson: '{"roles":["pm","architect","engineer"]}',
    });
    await completeRun(project.id, project.ownerToken, run.id, {
      status: "completed",
    });
    const version = await createVersion(project.id, project.ownerToken, {
      title: "带来源运行的版本",
      html: "<!doctype html><html><body>v1</body></html>",
      sourceRunId: run.id,
    });

    const loaded = await getProject(project.id, project.ownerToken);

    expect(loaded.messages).toHaveLength(1);
    expect(loaded.messages[0]).toMatchObject({ role: "leader", mention: "负责人" });
    expect(loaded.runs[0]).toMatchObject({ status: "completed" });
    expect(loaded.runs[0].finishedAt).toBeInstanceOf(Date);
    expect(loaded.runs[0].steps[0]).toMatchObject({
      role: "leader",
      artifactType: "plan",
    });
    expect(loaded.versions[0]).toMatchObject({ sourceRunId: run.id });

    await expect(
      appendMessage(project.id, "wrong-token", {
        role: "leader",
        kind: "assistant",
        content: "不可写入",
      }),
    ).rejects.toThrow("Project not found");
    await expect(getProject(project.id, "wrong-token")).rejects.toThrow(
      "Project not found",
    );
    await expect(
      createRun(project.id, "wrong-token", { mode: "team", status: "running" }),
    ).rejects.toThrow("Project not found");
    await expect(
      createRunStep(project.id, "wrong-token", run.id, {
        role: "leader",
        status: "completed",
        inputSummary: "不可写入",
      }),
    ).rejects.toThrow("Project not found");
    await expect(
      completeRun(project.id, "wrong-token", run.id, { status: "completed" }),
    ).rejects.toThrow("Project not found");
    await expect(
      createVersion(project.id, "wrong-token", {
        title: "不可写入",
        html: "<!doctype html><html><body>nope</body></html>",
      }),
    ).rejects.toThrow("Project not found");
    await expect(
      restoreVersion(project.id, "wrong-token", version.id),
    ).rejects.toThrow("Project not found");
  });
});
