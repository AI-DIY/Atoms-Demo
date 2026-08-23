"use client";

import { useEffect, useRef, useState } from "react";
import {
  approveRun,
  createProject,
  loadProject,
  restoreVersion,
  startRun,
  logoutUser,
  type LoadedProject,
  type ProjectIdentity,
  type ProjectInput,
} from "@/lib/client-api";
import { defaultProject } from "@/lib/default-project";
import {
  readProjectIdentity,
  projectIdentityStorageKey,
  restoreOrCreateProject,
} from "@/lib/project-session";
import { parseFirstMention } from "@/lib/mention";
import { ConversationPanel } from "./ConversationPanel";
import { ModelConfigForm } from "../auth/ModelConfigForm";
import { NewProjectDialog } from "./NewProjectDialog";
import { PreviewPanel } from "./PreviewPanel";
import { ProjectSidebar } from "./ProjectSidebar";
import type { TimelineEvent } from "./AgentTimeline";

function eventData(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? data as Record<string, unknown> : {};
}

function latestAwaitingTeamRunId(project: LoadedProject): string | null {
  const pendingRuns = (project.runs ?? []).filter(
    (run) => run.mode === "team" && run.status === "awaiting_approval",
  );
  const latest = pendingRuns.reduce<typeof pendingRuns[number] | undefined>(
    (current, run) => {
      if (!current) {
        return run;
      }

      return (run.startedAt ?? "") > (current.startedAt ?? "") ? run : current;
    },
    undefined,
  );

  return latest?.id ?? null;
}

function storedPlanGoal(project: LoadedProject | null, runId: string): string | null {
  const planJson = project?.runs?.find((run) => run.id === runId)?.planJson;

  if (typeof planJson !== "string") {
    return null;
  }

  try {
    const plan: unknown = JSON.parse(planJson);

    if (!plan || typeof plan !== "object" || Array.isArray(plan)) {
      return null;
    }

    const goal = Reflect.get(plan, "goal");
    return typeof goal === "string" && goal.trim().length > 0 ? goal : null;
  } catch {
    return null;
  }
}

type RunMode = "team" | "mention" | "iterate";
type FailedOperation =
  | { kind: "run"; mode: RunMode; request: string }
  | { kind: "approve"; runId: string; request: string };

function statusForEvent(
  name: string,
  payload: Record<string, unknown>,
  mode: RunMode,
): LoadedProject["status"] | null {
  if (name === "run.started") {
    if (mode === "mention") {
      return null;
    }

    return mode === "iterate" ? "iterating" : "planning";
  }

  if (name === "step.started") {
    if (mode === "mention") {
      return null;
    }

    if (mode === "iterate") {
      return "iterating";
    }

    if (payload.role === "leader") {
      return "planning";
    }

    return payload.role === "reviewer" ? "reviewing" : "building";
  }

  if (name === "run.awaiting_approval") {
    return "awaiting_approval";
  }

  if (name === "run.completed") {
    return mode === "mention" ? null : "ready";
  }

  if (name === "step.failed" || name === "run.failed") {
    return mode === "mention" ? null : "failed";
  }

  return null;
}

export function WorkspaceShell({ userEmail }: { userEmail?: string } = {}) {
  const [identity, setIdentity] = useState<ProjectIdentity | null>(null);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [approvalRunId, setApprovalRunId] = useState<string | null>(null);
  const [pendingApprovalRequest, setPendingApprovalRequest] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [lastFailedOperation, setLastFailedOperation] = useState<FailedOperation | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const activeGenerationRef = useRef(0);
  const generationRef = useRef(0);
  const runActiveRef = useRef(false);
  const restoreActiveRef = useRef(false);
  const pendingApprovalRequestRef = useRef<string | null>(null);

  function setPendingApproval(runId: string | null, request: string | null) {
    setApprovalRunId(runId);
    pendingApprovalRequestRef.current = request;
    setPendingApprovalRequest(request);
  }

  async function refreshProject(activeIdentity: ProjectIdentity, generation: number) {
    const refreshed = await loadProject(activeIdentity);

    if (generation === activeGenerationRef.current) {
      setProject(refreshed);
      const runId = latestAwaitingTeamRunId(refreshed);

      if (runId) {
        const request = storedPlanGoal(refreshed, runId);
        pendingApprovalRequestRef.current = request;
        setPendingApprovalRequest(request);
      }
    }
  }

  function receiveEvent(
    generation: number,
    mode: RunMode,
    name: string,
    data: unknown,
    failedOperation?: FailedOperation,
  ) {
    if (generation !== activeGenerationRef.current) {
      return;
    }

    const payload = eventData(data);
    setEvents((current) => [...current, { name, data: payload }]);
    const nextStatus = statusForEvent(name, payload, mode);

    if (nextStatus) {
      setProject((current) => current ? { ...current, status: nextStatus } : current);
    }

    if (name === "run.awaiting_approval" && typeof payload.runId === "string") {
      const request = failedOperation?.kind === "run" && failedOperation.mode === "team"
        ? failedOperation.request
        : storedPlanGoal(project, payload.runId);
      setPendingApproval(payload.runId, request);
    }

    if (name === "run.completed") {
      setPendingApproval(null, null);
    }

    if ((name === "run.awaiting_approval" || name === "run.completed") && identity) {
      void refreshProject(identity, generation).catch(() => {
        if (generation === activeGenerationRef.current) {
          setLoadError("项目状态已更新，但项目刷新失败，请刷新页面后重试。");
        }
      });
    }

    if (name === "run.failed") {
      setPendingApproval(null, null);
      const error = typeof payload.error === "string" ? payload.error : "团队运行失败，请重试。";
      setLoadError(error);
      if (failedOperation?.kind === "approve") {
        setLastFailedOperation({
          kind: "run",
          mode: "team",
          request: failedOperation.request,
        });
      } else if (failedOperation) {
        setLastFailedOperation(failedOperation);
      }
    }
  }

  useEffect(() => {
    let cancelled = false;

    void restoreOrCreateProject({
      storage: window.localStorage,
      api: { createProject, loadProject },
      defaultProject,
    })
      .then((loadedProject) => {
        if (!cancelled) {
          setProject(loadedProject);
          setIdentity(readProjectIdentity(window.localStorage));
          const runId = latestAwaitingTeamRunId(loadedProject);
          setPendingApproval(runId, runId ? storedPlanGoal(loadedProject, runId) : null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setLoadError("项目暂时无法加载，请刷新后重试。");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  async function requestPlan(
    request: string,
    preserveHistory = false,
    retryMode?: RunMode,
  ) {
    if (!identity || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    runActiveRef.current = true;
    setRunning(true);
    setLoadError(null);
    setLastFailedOperation(null);
    setPendingApproval(null, null);
    if (!preserveHistory) {
      setEvents([]);
    }
    const mode: RunMode = retryMode ?? (parseFirstMention(request)
      ? "mention"
      : project?.status === "ready"
        ? "iterate"
        : "team");

    try {
      await startRun(
        identity.projectId,
        identity.ownerToken,
        { mode, request },
        (name, data) => receiveEvent(
          generation,
          mode,
          name,
          data,
          { kind: "run", mode, request },
        ),
      );
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setLoadError(error instanceof Error ? error.message : "制定团队计划失败，请稍后重试。");
        setLastFailedOperation({ kind: "run", mode, request });
      }
    } finally {
      if (generation === activeGenerationRef.current) {
        runActiveRef.current = false;
        setRunning(false);
      }
    }
  }

  async function approvePlan(runId = approvalRunId, capturedRequest?: string) {
    if (!identity || !runId || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const request = capturedRequest
      ?? pendingApprovalRequestRef.current
      ?? pendingApprovalRequest
      ?? storedPlanGoal(project, runId)
      ?? project?.goal
      ?? defaultProject.goal;

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    runActiveRef.current = true;
    setRunning(true);
    setLoadError(null);
    setLastFailedOperation(null);

    try {
      await approveRun(
        identity.projectId,
        identity.ownerToken,
        runId,
        (name, data) => receiveEvent(
          generation,
          "team",
          name,
          data,
          { kind: "approve", runId, request },
        ),
      );
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setLoadError(error instanceof Error ? error.message : "开始构建失败，请稍后重试。");
        setLastFailedOperation({ kind: "approve", runId, request });
      }
    } finally {
      if (generation === activeGenerationRef.current) {
        runActiveRef.current = false;
        setRunning(false);
      }
    }
  }

  function retryLastFailure() {
    if (!lastFailedOperation) return;

    if (lastFailedOperation.kind === "approve") {
      void approvePlan(lastFailedOperation.runId, lastFailedOperation.request);
      return;
    }

    void requestPlan(
      lastFailedOperation.request,
      true,
      lastFailedOperation.mode,
    );
  }

  async function createNewProject(input: ProjectInput) {
    if (creatingProject || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    setCreatingProject(true);
    setCreateError(null);

    try {
      const created = await createProject(input);
      const nextIdentity = { projectId: created.id, ownerToken: created.ownerToken };
      const nextProject = await loadProject(nextIdentity);

      if (generation !== activeGenerationRef.current) {
        return;
      }

      window.localStorage.setItem(projectIdentityStorageKey, JSON.stringify(nextIdentity));
      setIdentity(nextIdentity);
      setProject(nextProject);
      setEvents([]);
      setPendingApproval(null, null);
      setLoadError(null);
      setRestoreError(null);
      setLastFailedOperation(null);
      setCreateDialogOpen(false);
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setCreateError(error instanceof Error ? error.message : "创建项目失败，请稍后重试。");
      }
    } finally {
      if (generation === activeGenerationRef.current) {
        setCreatingProject(false);
      }
    }
  }

  async function restoreSelectedVersion(versionId: string) {
    if (!identity || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    restoreActiveRef.current = true;
    setRestoring(true);
    setRestoreError(null);

    try {
      const restored = await restoreVersion(
        identity.projectId,
        identity.ownerToken,
        versionId,
      );

      if (generation === activeGenerationRef.current) {
        setProject(restored.project);
      }
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        const message = error instanceof Error ? error.message : "恢复版本失败";
        setRestoreError(`恢复版本失败：${message}`);
      }
    } finally {
      restoreActiveRef.current = false;
      setRestoring(false);
    }
  }

  const title = project?.title ?? "正在加载项目";
  const goal = project?.goal ?? "正在获取项目目标，请稍候。";

  return (
    <>
      <main className="workspace">
      <aside aria-label="Projects" className="sidebar">
        <ProjectSidebar
          creating={creatingProject || running || restoring}
          loading={!project && !loadError}
          onCreate={() => {
            setCreateError(null);
            setCreateDialogOpen(true);
          }}
          title={title}
          email={userEmail}
          onModelConfig={() => setSettingsOpen(true)}
          onLogout={() => { void logoutUser().then(() => window.location.reload()); }}
        />
      </aside>
      <section aria-label="Agent conversation" className="conversation">
        <ConversationPanel
          awaitingApproval={Boolean(approvalRunId)}
          canRetry={Boolean(lastFailedOperation)}
          error={loadError}
          events={events}
          loading={!project && !loadError}
          messages={project?.messages ?? []}
          onApprove={() => {
            void approvePlan();
          }}
          onRequestPlan={(request) => {
            void requestPlan(request);
          }}
          onRetry={() => {
            void retryLastFailure();
          }}
          projectGoal={goal}
          projectTitle={title}
          running={running || restoring}
          status={project?.status ?? "加载中"}
        />
      </section>
      <section aria-label="Application preview" className="preview-region">
        <PreviewPanel
          currentVersion={project?.currentVersion ?? 0}
          onRestore={restoreSelectedVersion}
          projectTitle={title}
          restoreError={restoreError}
          restoring={restoring}
          versions={project?.versions ?? []}
        />
      </section>
      </main>
      {createDialogOpen ? (
        <NewProjectDialog
          creating={creatingProject}
          error={createError}
          onCancel={() => setCreateDialogOpen(false)}
          onCreate={(input) => {
            void createNewProject(input);
          }}
        />
      ) : null}
      {settingsOpen ? (
        <div className="dialog-backdrop" role="presentation">
          <section className="model-config-dialog" aria-label="模型配置">
            <header><p className="eyebrow">账户设置</p><h2>模型配置</h2><p>修改当前用户的 Responses API 连接和模型参数。</p></header>
            <ModelConfigForm onSaved={() => setSettingsOpen(false)} onCancel={() => setSettingsOpen(false)} />
          </section>
        </div>
      ) : null}
    </>
  );
}
