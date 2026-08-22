import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST } from "@/app/api/projects/route";
import { GET } from "@/app/api/projects/[projectId]/route";
import { createProjectInput, maxProjectRequestBytes } from "@/lib/project-input";
import { prisma } from "@/server/prisma";

const projectInput = {
  title: "  摄影预约助手  ",
  goal: "  为摄影师创建可安排时段与跟进报价的预约工具。  ",
};

describe("projects API", () => {
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

  it("trims valid project input and rejects invalid input", () => {
    expect(createProjectInput.parse(projectInput)).toEqual({
      title: "摄影预约助手",
      goal: "为摄影师创建可安排时段与跟进报价的预约工具。",
    });
    expect(createProjectInput.safeParse({ title: "   ", goal: "太短" }).success).toBe(false);
    expect(
      createProjectInput.safeParse({
        title: "x".repeat(81),
        goal: "满足最短长度的项目目标",
      }).success,
    ).toBe(false);
  });

  it("creates a project and returns its anonymous owner token", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectInput),
      }),
    );

    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({
      id: expect.any(String),
      ownerToken: expect.any(String),
      title: "摄影预约助手",
      goal: "为摄影师创建可安排时段与跟进报价的预约工具。",
      status: "draft",
    });
  });

  it("limits project creation to five requests per IP in ten minutes", async () => {
    for (let index = 0; index < 5; index += 1) {
      const response = await POST(
        new Request("http://localhost/api/projects", {
          method: "POST",
          headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20" },
          body: JSON.stringify(projectInput),
        }),
      );
      expect(response.status).toBe(201);
    }

    const rejected = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json", "x-forwarded-for": "198.51.100.20" },
        body: JSON.stringify(projectInput),
      }),
    );

    expect(rejected.status).toBe(429);
    await expect(rejected.json()).resolves.toEqual({ error: "请求过于频繁，请稍后重试。" });
  });

  it("rejects a project request whose declared content length exceeds the safety limit", async () => {
    const response = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "content-length": String(maxProjectRequestBytes + 1),
        },
        body: JSON.stringify(projectInput),
      }),
    );

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Request body too large" });
  });

  it("rejects a chunked request that exceeds the safety limit without Content-Length", async () => {
    const body = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(maxProjectRequestBytes));
        controller.enqueue(new Uint8Array([0]));
        controller.close();
      },
    });
    const request = new Request("http://localhost/api/projects", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body,
      duplex: "half",
    } as RequestInit & { duplex: "half" });

    expect(request.headers.get("content-length")).toBeNull();

    const response = await POST(request);

    expect(response.status).toBe(413);
    await expect(response.json()).resolves.toEqual({ error: "Request body too large" });
  });

  it("loads a project for its owner without exposing the owner token", async () => {
    const createdResponse = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectInput),
      }),
    );
    const created = (await createdResponse.json()) as { id: string; ownerToken: string };

    const response = await GET(
      new Request(`http://localhost/api/projects/${created.id}`, {
        headers: { "x-project-token": created.ownerToken },
      }),
      { params: Promise.resolve({ projectId: created.id }) },
    );
    const project = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(200);
    expect(project).toMatchObject({ id: created.id, title: "摄影预约助手" });
    expect(project).not.toHaveProperty("ownerToken");
  });

  it("returns 404 for an invalid owner token without leaking project data", async () => {
    const createdResponse = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectInput),
      }),
    );
    const created = (await createdResponse.json()) as { id: string };

    const response = await GET(
      new Request(`http://localhost/api/projects/${created.id}`, {
        headers: { "x-project-token": "wrong-token" },
      }),
      { params: Promise.resolve({ projectId: created.id }) },
    );
    const responseBody = (await response.json()) as Record<string, unknown>;

    expect(response.status).toBe(404);
    expect(responseBody).not.toHaveProperty("ownerToken");
    expect(responseBody).not.toHaveProperty("goal");
  });

  it("returns 404 for an unknown project id", async () => {
    const response = await GET(
      new Request("http://localhost/api/projects/missing-project", {
        headers: { "x-project-token": "any-owner-token" },
      }),
      { params: Promise.resolve({ projectId: "missing-project" }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found" });
  });

  it("returns 404 when the owner token header is missing", async () => {
    const createdResponse = await POST(
      new Request("http://localhost/api/projects", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(projectInput),
      }),
    );
    const created = (await createdResponse.json()) as { id: string };

    const response = await GET(
      new Request(`http://localhost/api/projects/${created.id}`),
      { params: Promise.resolve({ projectId: created.id }) },
    );

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toEqual({ error: "Project not found" });
  });
});
