import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError } from "@/lib/client-api";
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

  it("deduplicates concurrent first-time restores into one create and one load", async () => {
    const createdProject = {
      id: "project-1",
      ownerToken: "owner-token-1",
      ...defaultProject,
      status: "draft",
    };
    let resolveCreated!: (project: typeof createdProject) => void;
    const created = new Promise<typeof createdProject>((resolve) => {
      resolveCreated = resolve;
    });
    const loadedProject = {
      id: "project-1",
      ...defaultProject,
      status: "draft",
      currentVersion: 0,
    };
    const api = {
      createProject: vi.fn().mockReturnValue(created),
      loadProject: vi.fn().mockResolvedValue(loadedProject),
    };

    const first = restoreOrCreateProject({
      storage: window.localStorage,
      api,
      defaultProject,
    });
    const second = restoreOrCreateProject({
      storage: window.localStorage,
      api,
      defaultProject,
    });

    expect(api.createProject).toHaveBeenCalledTimes(1);
    resolveCreated(createdProject);

    const [firstProject, secondProject] = await Promise.all([first, second]);

    expect(api.loadProject).toHaveBeenCalledTimes(1);
    expect(firstProject).toBe(loadedProject);
    expect(secondProject).toBe(loadedProject);
  });

  it("replaces only a stored identity that the API reports as missing", async () => {
    window.localStorage.setItem(
      projectIdentityStorageKey,
      JSON.stringify({ projectId: "missing-project", ownerToken: "stale-token" }),
    );
    window.localStorage.setItem("unrelated-key", "keep-me");
    const recreated = {
      id: "project-2",
      ownerToken: "owner-token-2",
      ...defaultProject,
      status: "draft",
    };
    const loadedProject = {
      id: "project-2",
      ...defaultProject,
      status: "draft",
      currentVersion: 0,
    };
    const api = {
      createProject: vi.fn().mockResolvedValue(recreated),
      loadProject: vi
        .fn()
        .mockRejectedValueOnce(new ApiError(404, "Project not found"))
        .mockResolvedValueOnce(loadedProject),
    };

    const project = await restoreOrCreateProject({
      storage: window.localStorage,
      api,
      defaultProject,
    });

    expect(project).toBe(loadedProject);
    expect(api.createProject).toHaveBeenCalledOnce();
    expect(api.loadProject).toHaveBeenNthCalledWith(1, {
      projectId: "missing-project",
      ownerToken: "stale-token",
    });
    expect(api.loadProject).toHaveBeenNthCalledWith(2, {
      projectId: "project-2",
      ownerToken: "owner-token-2",
    });
    expect(JSON.parse(window.localStorage.getItem(projectIdentityStorageKey) ?? "{}")).toEqual({
      projectId: "project-2",
      ownerToken: "owner-token-2",
    });
    expect(window.localStorage.getItem("unrelated-key")).toBe("keep-me");
  });

  it("keeps a stored identity and does not recreate on a non-404 API error", async () => {
    const identity = { projectId: "project-1", ownerToken: "owner-token-1" };
    window.localStorage.setItem(projectIdentityStorageKey, JSON.stringify(identity));
    const api = {
      createProject: vi.fn(),
      loadProject: vi.fn().mockRejectedValue(new ApiError(500, "Provider unavailable")),
    };

    await expect(
      restoreOrCreateProject({ storage: window.localStorage, api, defaultProject }),
    ).rejects.toMatchObject({ status: 500 });

    expect(api.createProject).not.toHaveBeenCalled();
    expect(window.localStorage.getItem(projectIdentityStorageKey)).toBe(JSON.stringify(identity));
  });

  it("continues creating a project when browser storage is unavailable", async () => {
    const storage = {
      getItem: vi.fn(() => {
        throw new Error("Storage unavailable");
      }),
      setItem: vi.fn(() => {
        throw new Error("Storage unavailable");
      }),
    } as unknown as Storage;
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

    await expect(
      restoreOrCreateProject({ storage, api, defaultProject }),
    ).resolves.toMatchObject({ id: "project-1" });
    expect(api.createProject).toHaveBeenCalledOnce();
  });
});
