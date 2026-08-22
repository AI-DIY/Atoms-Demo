import { describe, expect, it, vi } from "vitest";
import { createProject, loadProject } from "@/lib/client-api";

describe("client project API", () => {
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
});
