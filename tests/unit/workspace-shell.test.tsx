import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/lib/default-project";
import type { LoadedProject } from "@/lib/client-api";
import { projectIdentityStorageKey } from "@/lib/project-session";

const clientApi = vi.hoisted(() => ({
  createProject: vi.fn(),
  loadProject: vi.fn(),
  restoreVersion: vi.fn(),
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

const loadedProject: LoadedProject = {
  id: "project-1",
  ...defaultProject,
  status: "draft",
  currentVersion: 0,
  runs: [],
  versions: [],
};

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((resolvePromise) => {
    resolve = resolvePromise;
  });

  return { promise, resolve };
}

describe("WorkspaceShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clientApi.createProject.mockReset();
    clientApi.loadProject.mockReset();
    clientApi.restoreVersion.mockReset();
    clientApi.startRun.mockReset();
    clientApi.createProject.mockResolvedValue(createdProject);
    clientApi.loadProject.mockResolvedValue(loadedProject);
    clientApi.restoreVersion.mockResolvedValue({ project: loadedProject });
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
    expect(screen.getByRole("textbox", { name: "描述你要构建的产品" }))
      .toHaveValue(defaultProject.goal);
  });

  it("creates a named project and switches the active workspace", async () => {
    const input = {
      title: "婚礼摄影管家",
      goal: "为婚礼摄影团队统一安排档期、报价与客户跟进。",
    };
    const created = { id: "project-2", ownerToken: "owner-token-2", status: "draft", ...input };
    const loaded: LoadedProject = {
      id: "project-2",
      status: "draft",
      currentVersion: 0,
      runs: [],
      versions: [],
      ...input,
    };
    clientApi.createProject.mockResolvedValueOnce(createdProject).mockResolvedValueOnce(created);
    clientApi.loadProject.mockResolvedValueOnce(loadedProject).mockResolvedValueOnce(loaded);

    render(<WorkspaceShell />);

    await screen.findByRole("heading", { name: defaultProject.title });
    fireEvent.click(screen.getByRole("button", { name: "新建项目" }));

    const dialog = screen.getByRole("dialog", { name: "新建项目" });
    fireEvent.change(within(dialog).getByLabelText("项目名称"), { target: { value: input.title } });
    fireEvent.change(within(dialog).getByLabelText("项目目标"), { target: { value: input.goal } });
    fireEvent.click(within(dialog).getByRole("button", { name: "创建项目" }));

    await waitFor(() => {
      expect(clientApi.createProject).toHaveBeenLastCalledWith(input);
      expect(clientApi.loadProject).toHaveBeenLastCalledWith({
        projectId: "project-2",
        ownerToken: "owner-token-2",
      });
    });
    expect(await screen.findByRole("heading", { name: input.title })).toBeInTheDocument();
    expect(JSON.parse(window.localStorage.getItem(projectIdentityStorageKey) ?? "{}")).toEqual({
      projectId: "project-2",
      ownerToken: "owner-token-2",
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

  it("does not render a manual approval control for a persisted team plan", async () => {
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

    expect(await screen.findByText("构建中")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "开始构建" })).not.toBeInTheDocument();
  });

  it("同步失败事件到目标状态", async () => {
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
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

  it("shows the server-provided rate limit message without clearing existing messages", async () => {
    clientApi.loadProject.mockResolvedValue({
      ...loadedProject,
      messages: [{ id: "message-1", role: "research", kind: "assistant", content: "已有研究结论" }],
    });
    clientApi.startRun.mockRejectedValue(new Error("请求过于频繁，请稍后重试。"));
    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约工具" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("请求过于频繁，请稍后重试。");
    });
    expect(screen.getByText("已有研究结论")).toBeInTheDocument();
  });

  it("retries a failed run with its original request and preserves existing events", async () => {
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("step.started", { role: "leader" });
        throw new Error("请求过于频繁，请稍后重试。");
      },
    );
    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约工具" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));
    await screen.findByRole("alert");
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledTimes(2);
      expect(clientApi.startRun).toHaveBeenNthCalledWith(
        2,
        "project-1",
        "owner-token-1",
        { mode: "team", request: "为摄影师创建预约工具" },
        expect.any(Function),
      );
    });
    expect(within(screen.getByLabelText("智能体运行时间线")).getAllByText("团队负责人")).toHaveLength(2);
  });

  it("retries a run.failed stream with its original iteration request while preserving project content", async () => {
    clientApi.loadProject.mockResolvedValue({
      ...loadedProject,
      status: "ready",
      currentVersion: 1,
      messages: [{ id: "message-1", role: "pm", kind: "assistant", content: "已有产品结论" }],
      versions: [{ id: "version-1", version: 1, title: "现有版本", html: "<h1>现有版本</h1>" }],
    });
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("step.started", { role: "engineer" });
        onEvent("run.failed", { error: "构建服务不可用" });
      },
    );
    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "将预约表单改为双列布局" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(screen.getByRole("alert")).toHaveTextContent("构建服务不可用");
    });
    expect(screen.getByText("已有产品结论")).toBeInTheDocument();
    expect(screen.getByTitle("Generated application")).toHaveAttribute("srcdoc", "<h1>现有版本</h1>");

    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledTimes(2);
      expect(clientApi.startRun).toHaveBeenNthCalledWith(
        2,
        "project-1",
        "owner-token-1",
        { mode: "iterate", request: "将预约表单改为双列布局" },
        expect.any(Function),
      );
    });
    expect(within(screen.getByLabelText("智能体运行时间线")).getAllByText("工程师")).toHaveLength(2);
  });

  it("在 reviewer 开始验收时更新目标状态", async () => {
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("step.started", { role: "reviewer" });
      },
    );

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约工具" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    expect(await screen.findByText("验收中")).toBeInTheDocument();
  });

  it("在团队计划流未结束时禁用重复提交", async () => {
    const plan = deferred<void>();
    clientApi.startRun.mockReturnValue(plan.promise);

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "为摄影师创建预约工具" } });
    const planButton = screen.getByRole("button", { name: "制定团队计划" });
    fireEvent.click(planButton);
    fireEvent.click(planButton);

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledTimes(1);
      expect(planButton).toBeDisabled();
    });

    plan.resolve();
  });

  it("starts a team build and refreshes the completed version without approval", async () => {
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
        onEvent("step.started", { runId: "run-1", role: "leader" });
        onEvent("step.started", { runId: "run-1", role: "engineer" });
        onEvent("step.started", { runId: "run-1", role: "reviewer" });
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

    await waitFor(() => {
      expect(clientApi.loadProject).toHaveBeenCalledTimes(2);
    });
    expect(screen.queryByRole("button", { name: "开始构建" })).not.toBeInTheDocument();
    expect(screen.getByTitle("Generated application")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("构建完成"),
    );
  });

  it("routes the first valid mention to the requested specialist", async () => {
    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "@研究员 请分析目标用户" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        { mode: "mention", request: "@研究员 请分析目标用户" },
        expect.any(Function),
      );
    });
  });

  it("刷新 mention 完成后已持久化的用户和专家消息", async () => {
    const request = "@研究员 请分析目标用户";
    clientApi.loadProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce({
        ...loadedProject,
        messages: [
          { id: "message-user", role: "user", kind: "user", content: request },
          {
            id: "message-research",
            role: "research",
            kind: "assistant",
            content: "已整理目标用户的初步研究假设。",
          },
        ],
      });
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("run.completed", { runId: "mention-run" });
      },
    );

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: request } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    expect(await screen.findByText(request)).toBeInTheDocument();
    expect(screen.getByText("已整理目标用户的初步研究假设。")).toBeInTheDocument();
    expect(clientApi.loadProject).toHaveBeenCalledTimes(2);
  });

  it("刷新自动构建后已持久化的团队问题", async () => {
    const request = "为摄影师创建预约与报价工具";
    clientApi.loadProject
      .mockResolvedValueOnce(loadedProject)
      .mockResolvedValueOnce({
        ...loadedProject,
        status: "ready",
        messages: [
          { id: "message-user", role: "user", kind: "user", content: request },
        ],
      });
    clientApi.startRun.mockImplementation(
      async (
        _projectId: string,
        _ownerToken: string,
        _body: unknown,
        onEvent: (name: string, data: unknown) => void,
      ) => {
        onEvent("run.completed", { runId: "team-run", versionId: "version-1" });
      },
    );

    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: request } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    expect(await screen.findByText(request)).toBeInTheDocument();
    expect(clientApi.loadProject).toHaveBeenCalledTimes(2);
  });

  it("routes a ready project without a mention to iteration", async () => {
    clientApi.loadProject.mockResolvedValue({
      ...loadedProject,
      status: "ready",
      currentVersion: 1,
      versions: [{ id: "version-1", version: 1, title: "预约工具", html: "<h1>当前版本</h1>" }],
    });
    render(<WorkspaceShell />);

    const goal = await screen.findByPlaceholderText("描述你要构建的产品");
    fireEvent.change(goal, { target: { value: "将预约表单改为双列布局" } });
    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));

    await waitFor(() => {
      expect(clientApi.startRun).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        { mode: "iterate", request: "将预约表单改为双列布局" },
        expect.any(Function),
      );
    });
  });

  it("restores a selected version through the API only once while it is running", async () => {
    const restoring = deferred<{ project: LoadedProject }>();
    clientApi.loadProject.mockResolvedValue({
      ...loadedProject,
      status: "ready",
      currentVersion: 2,
      versions: [
        { id: "version-1", version: 1, title: "首版", html: "<h1>首版</h1>" },
        { id: "version-2", version: 2, title: "第二版", html: "<h1>第二版</h1>" },
      ],
    });
    clientApi.restoreVersion.mockReturnValue(restoring.promise);
    render(<WorkspaceShell />);

    await screen.findByTitle("Generated application");
    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    const versionOne = screen.getByRole("button", { name: "V1" });
    fireEvent.click(versionOne);
    fireEvent.click(versionOne);

    await waitFor(() => {
      expect(clientApi.restoreVersion).toHaveBeenCalledTimes(1);
      expect(clientApi.restoreVersion).toHaveBeenCalledWith(
        "project-1",
        "owner-token-1",
        "version-1",
      );
    });

    restoring.resolve({
      project: {
        ...loadedProject,
        status: "ready",
        currentVersion: 1,
        versions: [
          { id: "version-1", version: 1, title: "首版", html: "<h1>首版</h1>" },
          { id: "version-2", version: 2, title: "第二版", html: "<h1>第二版</h1>" },
        ],
      },
    });

    await waitFor(() => {
      expect(screen.getByTitle("Generated application")).toHaveAttribute(
        "srcdoc",
        expect.stringContaining("首版"),
      );
    });
  });

  it("blocks new runs while restoring and releases the restore guard afterwards", async () => {
    const firstRestore = deferred<{ project: LoadedProject }>();
    const secondRestore = deferred<{ project: LoadedProject }>();
    const restoredV1: LoadedProject = {
      ...loadedProject,
      status: "ready",
      currentVersion: 1,
      versions: [
        { id: "version-1", version: 1, title: "首版", html: "<h1>首版</h1>" },
        { id: "version-2", version: 2, title: "第二版", html: "<h1>第二版</h1>" },
      ],
    };
    clientApi.loadProject.mockResolvedValue({ ...restoredV1, currentVersion: 2 });
    clientApi.restoreVersion
      .mockReturnValueOnce(firstRestore.promise)
      .mockReturnValueOnce(secondRestore.promise);
    render(<WorkspaceShell />);

    await screen.findByTitle("Generated application");
    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    fireEvent.click(screen.getByRole("button", { name: "V1" }));

    const submit = screen.getByRole("button", { name: "制定团队计划" });
    await waitFor(() => expect(submit).toBeDisabled());
    fireEvent.click(submit);
    expect(clientApi.startRun).not.toHaveBeenCalled();

    firstRestore.resolve({ project: restoredV1 });
    await waitFor(() => expect(submit).not.toBeDisabled());

    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    fireEvent.click(screen.getByRole("button", { name: "V2" }));
    await waitFor(() => expect(clientApi.restoreVersion).toHaveBeenCalledTimes(2));

    secondRestore.resolve({ project: { ...restoredV1, currentVersion: 2 } });
  });
});
