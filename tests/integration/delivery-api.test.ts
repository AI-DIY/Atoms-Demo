import { randomUUID } from "node:crypto";
import { describe, expect, it } from "vitest";
import { prisma } from "@/server/prisma";
import { createSession } from "@/lib/auth-session";
import {
  createProject,
  createVersion,
  updateProjectStatus,
  restoreVersion,
} from "@/lib/repository";
import { GET as list } from "@/app/api/projects/route";
import {
  GET as readState,
  PUT as saveState,
} from "@/app/api/projects/[projectId]/state/route";
import {
  POST as publish,
  DELETE as unpublish,
} from "@/app/api/projects/[projectId]/publish/route";
import { PATCH as rename } from "@/app/api/projects/[projectId]/route";
import { POST as editCode } from "@/app/api/projects/[projectId]/versions/route";
import { teamGenerationGate } from "@/lib/execution-limits";

async function fixture() {
  const user = await prisma.user.create({
    data: { email: `${randomUUID()}@example.com`, passwordHash: "unused" },
  });
  const session = await createSession(user.id);
  const project = await createProject(
    { title: "交付验证", goal: "创建带有持久化数据的工作台" },
    user.id,
  );
  const cookie = `agent_studio_session=${session.token}`;
  const context = { params: Promise.resolve({ projectId: project.id }) };
  const req = (method = "GET", body?: unknown) =>
    new Request("http://localhost/api/projects", {
      method,
      headers: { cookie, "content-type": "application/json" },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  return { user, project, context, req };
}

describe("2.0 delivery APIs", () => {
  it("renames only owned projects and rejects unknown mutation fields", async () => {
    const a = await fixture();
    const b = await fixture();
    expect(
      (await rename(b.req("PATCH", { title: "恶意重命名" }), a.context)).status,
    ).toBe(404);
    expect(
      (
        await rename(
          a.req("PATCH", { title: "我的新项目", userId: b.user.id }),
          a.context,
        )
      ).status,
    ).toBe(400);
    const response = await rename(
      a.req("PATCH", { title: "  我的新项目  " }),
      a.context,
    );
    expect(response.status).toBe(200);
    const renamed = await response.json();
    expect(renamed.title).toBe("我的新项目");
    expect(renamed.ownerToken).toBeUndefined();
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } }))
        .goal,
    ).toBe(a.project.goal);
  });

  it("saves sanitized code as a new version without changing published content or app data", async () => {
    const a = await fixture();
    const b = await fixture();
    const html =
      '<!doctype html><html><head><title>编辑测试</title></head><body><h1>修改后的应用</h1><script src="https://example.com/evil.js"></script></body></html>';
    const payload = { html, baseVersion: 1 };
    await createVersion(a.project.id, a.project.ownerToken, {
      title: "原版本",
      html: "<h1>Original</h1>",
    });
    await updateProjectStatus(a.project.id, a.project.ownerToken, "ready");
    await publish(a.req("POST"), a.context);
    await saveState(a.req("PUT", { records: "saved" }), a.context);
    expect((await editCode(b.req("POST", payload), a.context)).status).toBe(
      404,
    );
    const response = await editCode(a.req("POST", payload), a.context);
    expect(response.status).toBe(201);
    const version = await response.json();
    expect(version.version).toBe(2);
    expect(version.html).toContain("修改后的应用");
    expect(version.html).not.toContain("evil.js");
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } }))
        .publishedVersion,
    ).toBe(1);
    expect(await (await readState(a.req(), a.context)).json()).toEqual({
      records: "saved",
    });
    expect((await editCode(a.req("POST", payload), a.context)).status).toBe(
      409,
    );
    const release = await teamGenerationGate.acquire();
    try {
      expect(
        (
          await editCode(
            a.req("POST", { ...payload, baseVersion: 2 }),
            a.context,
          )
        ).status,
      ).toBe(409);
    } finally {
      release();
    }
    expect(
      (
        await editCode(
          a.req("POST", { html: "界".repeat(20000), baseVersion: 2 }),
          a.context,
        )
      ).status,
    ).toBe(400);
    expect(
      await prisma.appVersion.count({ where: { projectId: a.project.id } }),
    ).toBe(2);
  });
  it("lists only the signed-in user's projects without credentials or content", async () => {
    const a = await fixture();
    const b = await fixture();
    const response = await list(a.req());
    const data = await response.json();
    expect(data.projects.map((p: { id: string }) => p.id)).toEqual([
      a.project.id,
    ]);
    expect(JSON.stringify(data)).not.toContain(b.project.id);
    expect(JSON.stringify(data)).not.toContain("ownerToken");
    expect((await list(new Request("http://localhost"))).status).toBe(401);
  });

  it("persists bounded application data and prevents cross-account writes", async () => {
    const a = await fixture();
    const b = await fixture();
    const data = { appointments: JSON.stringify([{ name: "验收客户" }]) };
    expect((await saveState(a.req("PUT", data), a.context)).status).toBe(200);
    expect(await (await readState(a.req(), a.context)).json()).toEqual(data);
    expect((await readState(b.req(), a.context)).status).toBe(404);
    expect((await saveState(b.req("PUT", {}), a.context)).status).toBe(404);
    expect((await saveState(a.req("PUT", { key: 12 }), a.context)).status).toBe(
      400,
    );
    expect(
      (await saveState(a.req("PUT", { key: "x".repeat(66_000) }), a.context))
        .status,
    ).toBe(413);
  });

  it("pins explicit publications, preserves state on restore, and revokes old links", async () => {
    const a = await fixture();
    const b = await fixture();
    expect((await publish(a.req("POST"), a.context)).status).toBe(409);
    expect((await publish(b.req("POST"), a.context)).status).toBe(404);
    const first = await createVersion(a.project.id, a.project.ownerToken, {
      title: "V1",
      html: "<h1>First</h1>",
    });
    await updateProjectStatus(a.project.id, a.project.ownerToken, "ready");
    const publicV1 = await (await publish(a.req("POST"), a.context)).json();
    await createVersion(a.project.id, a.project.ownerToken, {
      title: "V2",
      html: "<h1>Second</h1>",
    });
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } }))
        .publishedVersion,
    ).toBe(1);
    const publicV2 = await (await publish(a.req("POST"), a.context)).json();
    expect(publicV2).toEqual({
      shareToken: publicV1.shareToken,
      publishedVersion: 2,
    });
    await saveState(a.req("PUT", { value: "retained" }), a.context);
    await restoreVersion(a.project.id, a.project.ownerToken, first.id);
    expect(await (await readState(a.req(), a.context)).json()).toEqual({
      value: "retained",
    });
    expect(
      (await prisma.project.findUniqueOrThrow({ where: { id: a.project.id } }))
        .publishedVersion,
    ).toBe(2);
    expect((await unpublish(a.req("DELETE"), a.context)).status).toBe(200);
    expect(
      await prisma.project.findUnique({
        where: { shareToken: publicV1.shareToken },
      }),
    ).toBeNull();
    const next = await (await publish(a.req("POST"), a.context)).json();
    expect(next.shareToken).not.toBe(publicV1.shareToken);
  });
});
