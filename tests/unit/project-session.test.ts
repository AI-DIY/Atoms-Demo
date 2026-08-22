import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  projectIdentityStorageKey,
  restoreOrCreateProject,
} from "@/lib/project-session";

const defaultProject = {
  title: "摄影预约助手",
  goal: "为摄影师创建预约与报价工具，统一收集客户信息。",
};

describe("project session", () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it("creates once and stores the returned anonymous identity", async () => {
    const api = {
      createProject: vi.fn().mockResolvedValue({
        id: "project-1",
        ownerToken: "owner-token-1",
        ...defaultProject,
        status: "draft",
      }),
      loadProject: vi.fn().mockResolvedValue({
        id: "project-1",
        ...defaultProject,
        status: "draft",
        currentVersion: 0,
      }),
    };

    const project = await restoreOrCreateProject({
      storage: window.localStorage,
      api,
      defaultProject,
    });

    expect(api.createProject).toHaveBeenCalledWith(defaultProject);
    expect(api.loadProject).toHaveBeenCalledWith({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
    expect(project).toMatchObject({ id: "project-1", title: defaultProject.title });
    expect(JSON.parse(window.localStorage.getItem(projectIdentityStorageKey) ?? "{}")).toEqual({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
  });

  it("reloads the stored project instead of creating a second project", async () => {
    window.localStorage.setItem(
      projectIdentityStorageKey,
      JSON.stringify({ projectId: "project-1", ownerToken: "owner-token-1" }),
    );
    const api = {
      createProject: vi.fn(),
      loadProject: vi.fn().mockResolvedValue({
        id: "project-1",
        ...defaultProject,
        status: "draft",
        currentVersion: 0,
      }),
    };

    await restoreOrCreateProject({
      storage: window.localStorage,
      api,
      defaultProject,
    });

    expect(api.createProject).not.toHaveBeenCalled();
    expect(api.loadProject).toHaveBeenCalledWith({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
  });
});
