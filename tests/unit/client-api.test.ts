import { afterEach, describe, expect, it, vi } from "vitest";
import {
  ApiError,
  approveRun,
  createProject,
  loadProject,
  startRun,
} from "@/lib/client-api";

describe("client project API", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("sends the owner token only when loading a project", async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "project-1",
            ownerToken: "owner-token-1",
            title: "摄影预约助手",
            goal: "为摄影师创建预约与报价工具，统一收集客户信息。",
            status: "draft",
          }),
          { status: 201 },
        ),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({
            id: "project-1",
            title: "摄影预约助手",
            goal: "为摄影师创建预约与报价工具，统一收集客户信息。",
            status: "draft",
            currentVersion: 0,
          }),
          { status: 200 },
        ),
      );

    await createProject(
      {
        title: "摄影预约助手",
        goal: "为摄影师创建预约与报价工具，统一收集客户信息。",
      },
      fetcher,
    );
    await loadProject(
      { projectId: "project-1", ownerToken: "owner-token-1" },
      fetcher,
    );

    expect(fetcher).toHaveBeenNthCalledWith(
      1,
      "/api/projects",
      expect.objectContaining({
        method: "POST",
        headers: { "content-type": "application/json" },
      }),
    );
    expect(fetcher).toHaveBeenNthCalledWith(2, "/api/projects/project-1", {
      headers: { "x-project-token": "owner-token-1" },
    });
  });

  it("preserves the HTTP status in an API error", async () => {
    const fetcher = vi.fn().mockImplementation(() =>
      Promise.resolve(new Response("Project not found", { status: 404 })),
    );

    await expect(
      loadProject({ projectId: "missing", ownerToken: "owner-token" }, fetcher),
    ).rejects.toMatchObject({
      name: "ApiError",
      status: 404,
      message: "Project not found",
    });
    await expect(
      loadProject({ projectId: "missing", ownerToken: "owner-token" }, fetcher),
    ).rejects.toBeInstanceOf(ApiError);
  });

  it("reads complete and split SSE events with the project token", async () => {
    const encoder = new TextEncoder();
    const fetcher = vi.fn().mockResolvedValue(
      new Response(
        new ReadableStream({
          start(controller) {
            controller.enqueue(encoder.encode('event: run.started\ndata: {"runId":"run-'));
            controller.enqueue(encoder.encode('1"}\n\nevent: step.completed\ndata: {"role":"pm"}\n'));
            controller.enqueue(encoder.encode('\nevent: run.awaiting_approval\ndata: {"runId":"run-1"}\n\n'));
            controller.close();
          },
        }),
        { status: 200 },
      ),
    );
    const events: Array<[string, unknown]> = [];
    vi.stubGlobal("fetch", fetcher);

    await startRun(
      "project-1",
      "owner-token-1",
      { mode: "team", request: "为摄影师创建预约工具" },
      (name, data) => events.push([name, data]),
    );

    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/project-1/runs",
      expect.objectContaining({
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-project-token": "owner-token-1",
        },
      }),
    );
    expect(events).toEqual([
      ["run.started", { runId: "run-1" }],
      ["step.completed", { role: "pm" }],
      ["run.awaiting_approval", { runId: "run-1" }],
    ]);
  });

  it("throws the response text when starting a run fails", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("服务器繁忙", { status: 503 })));

    await expect(
      startRun(
        "project-1",
        "owner-token-1",
        { mode: "team", request: "为摄影师创建预约工具" },
        vi.fn(),
      ),
    ).rejects.toThrow("服务器繁忙");
  });

  it("extracts a JSON error message from a rejected run stream", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ error: "请求过于频繁，请稍后重试。" }),
      { status: 429, headers: { "content-type": "application/json" } },
    )));

    await expect(
      startRun(
        "project-1",
        "owner-token-1",
        { mode: "team", request: "为摄影师创建预约工具" },
        vi.fn(),
      ),
    ).rejects.toMatchObject({
      status: 429,
      message: "请求过于频繁，请稍后重试。",
    });
  });

  it("streams approval events to the run approval endpoint", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response('event: run.completed\ndata: {"versionId":"version-1"}\n\n', {
        status: 200,
      }),
    );
    const events: Array<[string, unknown]> = [];
    vi.stubGlobal("fetch", fetcher);

    await approveRun("project-1", "owner-token-1", "run-1", (name, data) => {
      events.push([name, data]);
    });

    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/project-1/runs/run-1/approve",
      {
        method: "POST",
        headers: { "x-project-token": "owner-token-1" },
      },
    );
    expect(events).toEqual([["run.completed", { versionId: "version-1" }]]);
  });

  it("restores a version with the project token and extracts the server JSON error", async () => {
    const restoreVersion = Reflect.get(
      await import("@/lib/client-api"),
      "restoreVersion",
    ) as
      | ((
          projectId: string,
          ownerToken: string,
          versionId: string,
          fetcher: typeof fetch,
        ) => Promise<unknown>)
      | undefined;

    expect(restoreVersion).toBeTypeOf("function");
    if (!restoreVersion) {
      return;
    }

    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: "Version not found" }), { status: 404 }),
    );

    await expect(
      restoreVersion("project-1", "owner-token-1", "version-1", fetcher),
    ).rejects.toMatchObject({
      status: 404,
      message: "Version not found",
    });
    expect(fetcher).toHaveBeenCalledWith(
      "/api/projects/project-1/versions/version-1/restore",
      { method: "POST", headers: { "x-project-token": "owner-token-1" } },
    );
  });
});
