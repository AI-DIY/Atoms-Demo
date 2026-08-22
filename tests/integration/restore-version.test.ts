import { afterAll, beforeEach, describe, expect, it } from "vitest";
import {
  chooseCurrentVersion,
  createProject,
  createVersion,
  getProject,
  restoreVersion,
} from "@/lib/repository";
import { prisma } from "@/server/prisma";

async function loadRestoreRoute() {
  try {
    return await import(
      "@/app/api/projects/[projectId]/versions/[versionId]/restore/route"
    );
  } catch {
    return null;
  }
}

describe("version restoration", () => {
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

  it("keeps all versions, selects the restored version, and records a system message", async () => {
    const project = await createProject({
      title: "版本恢复测试",
      goal: "恢复已生成页面的历史版本",
    });
    const first = await createVersion(project.id, project.ownerToken, {
      title: "首版",
      html: "<!doctype html><html><body>first version</body></html>",
    });
    await createVersion(project.id, project.ownerToken, {
      title: "第二版",
      html: "<!doctype html><html><body>second version</body></html>",
    });

    await restoreVersion(project.id, project.ownerToken, first.id);
    const loaded = await getProject(project.id, project.ownerToken);

    expect(loaded.currentVersion).toBe(1);
    expect(loaded.versions).toHaveLength(2);
    expect(chooseCurrentVersion(loaded.versions, loaded.currentVersion)).toMatchObject({
      id: first.id,
      version: 1,
    });
    expect(loaded.messages.at(-1)).toMatchObject({
      role: "system",
      kind: "system",
      content: "Restored version V1",
    });
  });

  it("rejects a missing current version instead of silently falling back", () => {
    expect(() => chooseCurrentVersion([{ version: 1 }], 2)).toThrow(
      "Version not found",
    );
  });

  it("restores an owned version through the API without exposing the owner token", async () => {
    const route = await loadRestoreRoute();

    expect(route).not.toBeNull();
    if (!route) {
      return;
    }

    const project = await createProject({
      title: "恢复接口测试",
      goal: "通过受保护接口恢复页面版本",
    });
    const first = await createVersion(project.id, project.ownerToken, {
      title: "首版",
      html: "<!doctype html><html><body>first version</body></html>",
    });
    await createVersion(project.id, project.ownerToken, {
      title: "第二版",
      html: "<!doctype html><html><body>second version</body></html>",
    });

    const response = await route.POST(
      new Request(
        `http://localhost/api/projects/${project.id}/versions/${first.id}/restore`,
        { method: "POST", headers: { "x-project-token": project.ownerToken } },
      ),
      { params: Promise.resolve({ projectId: project.id, versionId: first.id }) },
    );
    const body = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(body).toMatchObject({
      version: { id: first.id, version: 1 },
      project: { id: project.id, currentVersion: 1 },
    });
    expect(body).not.toHaveProperty("ownerToken");
    expect((body.project as Record<string, unknown>).ownerToken).toBeUndefined();
    expect((await getProject(project.id, project.ownerToken)).versions).toHaveLength(2);
  });

  it("hides invalid restore targets behind a 404", async () => {
    const route = await loadRestoreRoute();

    expect(route).not.toBeNull();
    if (!route) {
      return;
    }

    const project = await createProject({
      title: "恢复鉴权测试",
      goal: "拒绝未授权或不存在的恢复请求",
    });
    const version = await createVersion(project.id, project.ownerToken, {
      title: "首版",
      html: "<!doctype html><html><body>first version</body></html>",
    });

    const wrongToken = await route.POST(
      new Request("http://localhost/api/projects/private/versions/private/restore", {
        method: "POST",
        headers: { "x-project-token": "wrong-token" },
      }),
      { params: Promise.resolve({ projectId: project.id, versionId: version.id }) },
    );
    const unknownVersion = await route.POST(
      new Request("http://localhost/api/projects/private/versions/missing/restore", {
        method: "POST",
        headers: { "x-project-token": project.ownerToken },
      }),
      { params: Promise.resolve({ projectId: project.id, versionId: "missing-version" }) },
    );

    expect(wrongToken.status).toBe(404);
    await expect(wrongToken.json()).resolves.toEqual({ error: "Project not found" });
    expect(unknownVersion.status).toBe(404);
    await expect(unknownVersion.json()).resolves.toEqual({ error: "Version not found" });
  });
});
