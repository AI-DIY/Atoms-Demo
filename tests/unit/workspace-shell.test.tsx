import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/lib/default-project";
import { projectIdentityStorageKey } from "@/lib/project-session";

const clientApi = vi.hoisted(() => ({
  approveRun: vi.fn(),
  createProject: vi.fn(),
  loadProject: vi.fn(),
  startRun: vi.fn(),
}));

vi.mock("@/lib/client-api", () => clientApi);

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

const createdProject = {
  id: "project-1",
  ownerToken: "owner-token-1",
  ...defaultProject,
  status: "draft",
};

const loadedProject = {
  id: "project-1",
  ...defaultProject,
  status: "draft",
  currentVersion: 0,
  runs: [],
  versions: [],
};

describe("WorkspaceShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clientApi.createProject.mockReset();
    clientApi.loadProject.mockReset();
    clientApi.startRun.mockReset();
    clientApi.approveRun.mockReset();
    clientApi.createProject.mockResolvedValue(createdProject);
    clientApi.loadProject.mockResolvedValue(loadedProject);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders projects, conversation, and preview regions", () => {
    render(<WorkspaceShell />);

    expect(screen.getByLabelText("Projects")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent conversation")).toBeInTheDocument();
    expect(screen.getByLabelText("Application preview")).toBeInTheDocument();
  });

  it("creates the default project once, saves its identity, and loads it", async () => {
    render(<WorkspaceShell />);

    await waitFor(() => {
      expect(screen.getAllByText(defaultProject.title)).not.toHaveLength(0);
    });

    expect(clientApi.createProject).toHaveBeenCalledWith(defaultProject);
    expect(clientApi.loadProject).toHaveBeenCalledWith({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
    expect(JSON.parse(window.localStorage.getItem(projectIdentityStorageKey) ?? "{}")).toEqual({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
  });

  it("reuses a stored identity by loading instead of creating", async () => {
    window.localStorage.setItem(
      projectIdentityStorageKey,
      JSON.stringify({ projectId: "project-1", ownerToken: "owner-token-1" }),
    );

    render(<WorkspaceShell />);

    await waitFor(() => {
      expect(clientApi.loadProject).toHaveBeenCalledWith({
        projectId: "project-1",
        ownerToken: "owner-token-1",
      });
    });

    expect(clientApi.createProject).not.toHaveBeenCalled();
  });

  it("restores the latest awaiting team approval after loading the project", async () => {
    window.localStorage.setItem(
      projectIdentityStorageKey,
      JSON.stringify({ projectId: "project-1", ownerToken: "owner-token-1" }),
    );
    clientApi.loadProject.mockResolvedValueOnce({
      ...loadedProject,
      status: "awaiting_approval",
      runs: [
        { id: "old-run", mode: "team", status: "awaiting_approval", startedAt: "2026-08-21T10:00:00.000Z" },
        { id: "latest-run", mode: "team", status: "awaiting_approval", startedAt: "2026-08-22T10:00:00.000Z" },
        { id: "mention-run", mode: "mention", status: "awaiting_approval", startedAt: "2026-08-22T11:00:00.000Z" },
      ],
    });

    render(<WorkspaceShell />);

    expect(await screen.findByRole("button", { name: "开始构建" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "开始构建" }));

    await waitFor(() => {
      expect(clientApi.approveRun).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        "latest-run",
        expect.any(Function),
      );
    });
  });

  it("同步 awaiting approval 与 failed 事件到目标状态", async () => {
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("run.awaiting_approval", { runId: "run-status" });
        onEvent("run.failed", { error: "计划服务不可用" });
      },
    );

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约工具" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(screen.getByText("运行失败")).toBeInTheDocument();
      expect(screen.getByRole("alert")).toHaveTextContent("计划服务不可用");
    });
  });

  it("starts a team plan, approves it, and refreshes the completed version", async () => {
    const completedProject = {
      ...loadedProject,
      currentVersion: 1,
      status: "ready",
      versions: [
        {
          id: "version-1",
          version: 1,
          title: "摄影预约",
          html: "<h1>构建完成</h1>",
        },
      ],
    };
    clientApi.loadProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce(completedProject);
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("run.awaiting_approval", { runId: "run-1" });
      },
    );
    clientApi.approveRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _runId: string,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("run.completed", { runId: "run-1", versionId: "version-1" });
      },
    );

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约与报价工具" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        { mode: "team", request: "为摄影师创建预约与报价工具" },
        expect.any(Function),
      );
    });

    fireEvent.click(await screen.findByRole("button", { name: "开始构建" }));

    await waitFor(() => {
      expect(clientApi.approveRun).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        "run-1",
        expect.any(Function),
      );
      expect(clientApi.loadProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.getByTitle("Generated application")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("构建完成"),
    );
  });
});
