"use client";

import { useEffect, useRef, useState } from "react";
import {
  createProject,
  loadProject,
  restoreVersion,
  startRun,
  logoutUser,
  listProjects,
  type ProjectSummary,
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
import { NewProjectDialog } from "./NewProjectDialog";
import { PreviewPanel } from "./PreviewPanel";
import { ProjectSidebar } from "./ProjectSidebar";
import type { TimelineEvent } from "./AgentTimeline";

function eventData(data: unknown): Record<string, unknown> {
  return data && typeof data === "object" ? data as Record<string, unknown> : {};
}

type RunMode = "team" | "mention" | "iterate";
type FailedOperation = { mode: RunMode; request: string };

function statusForEvent(
  name: string,
  payload: Record<string, unknown>,
  mode: RunMode,
): LoadedProject["status"] | null {
  if (name === "run.started") {
    if (mode === "mention") {
      return null;
    }

    if (mode === "iterate") {
      return "iterating";
    }

    return "planning";
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
  const [projects, setProjects] = useState<ProjectSummary[]>([]);
  const [providerMode, setProviderMode] = useState("正在检查生成服务");
  const [mentionDraft, setMentionDraft] = useState<{ text: string; sequence: number }>();
  const [switching, setSwitching] = useState(false);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const [lastFailedOperation, setLastFailedOperation] = useState<FailedOperation | null>(null);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creatingProject, setCreatingProject] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const activeGenerationRef = useRef(0);
  const generationRef = useRef(0);
  const runActiveRef = useRef(false);
  const restoreActiveRef = useRef(false);

  async function refreshProject(activeIdentity: ProjectIdentity, generation: number) {
    const refreshed = await loadProject(activeIdentity);

    if (generation === activeGenerationRef.current) {
      setProject(refreshed);
      if (userEmail) void listProjects().then(setProjects).catch(() => undefined);

      if (refreshed.status === "ready") {
        setLoadError(null);
        setLastFailedOperation(null);
      }
    }
  }

  async function refreshAfterRun(activeIdentity: ProjectIdentity, generation: number) {
    try {
      await refreshProject(activeIdentity, generation);
    } catch {
      if (generation === activeGenerationRef.current) {
        setLoadError((current) => current ?? "运行已结束，但项目刷新失败，请刷新页面后重试。");
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

    if (name === "run.completed" && identity) {
      setLoadError(null);
      setLastFailedOperation(null);
      void refreshAfterRun(identity, generation);
    }

    if (name === "run.failed") {
      const error = typeof payload.error === "string" ? payload.error : "团队运行失败，请重试。";
      setLoadError(error);
      if (failedOperation) setLastFailedOperation(failedOperation);
    }
  }

  useEffect(() => {
    let cancelled = false;

    void restoreOrCreateProject({
      storage: window.localStorage,
      api: { createProject, loadProject, ...(userEmail ? { listProjects } : {}) },
      defaultProject,
    })
      .then((loadedProject) => {
        if (!cancelled) {
          setProject(loadedProject);
          setIdentity(readProjectIdentity(window.localStorage));
          if (userEmail) void listProjects().then(setProjects).catch(() => undefined);
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
  }, [userEmail]);

  useEffect(() => {
    void fetch("/api/health").then((response) => response.json()).then((health) => {
      setProviderMode(health.status !== "ok" ? "生成服务未配置" : health.mode === "demo" ? "演示模式 · 内置模板" : "真实 AI · Responses API");
    }).catch(() => setProviderMode("生成服务暂不可用"));
  }, []);

  async function switchProject(id: string) {
    if (running || restoring || switching || creatingProject || id === identity?.projectId) return;
    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    setSwitching(true);
    try {
      const nextIdentity = { projectId: id, ownerToken: "session" };
      const next = await loadProject(nextIdentity);
      window.localStorage.setItem(projectIdentityStorageKey, JSON.stringify(nextIdentity));
      setIdentity(nextIdentity); setProject(next); setEvents([]); setLoadError(null);
      setRestoreError(null); setLastFailedOperation(null); setMentionDraft({ text: next.currentVersion ? "" : next.goal, sequence: Date.now() });
    } catch { setLoadError("切换项目失败，请重试。"); }
    finally { setSwitching(false); }
  }

  async function requestPlan(
    request: string,
    preserveHistory = false,
    retryMode?: RunMode,
    preserveError = false,
  ) {
    if (!identity || switching || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    runActiveRef.current = true;
    setRunning(true);
    if (!preserveError) {
      setLoadError(null);
    }
    if (!preserveError) {
      setLastFailedOperation(null);
    }
    if (!preserveHistory) {
      setEvents([]);
    }
    const mode: RunMode = retryMode ?? (parseFirstMention(request)
      ? "mention"
      : project?.status === "ready" || (project?.status === "failed" && project.currentVersion > 0)
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
          { mode, request },
        ),
      );
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setLoadError(error instanceof Error ? error.message : "制定团队计划失败，请稍后重试。");
        setLastFailedOperation({ mode, request });
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

    void requestPlan(
      lastFailedOperation.request,
      true,
      lastFailedOperation.mode,
      true,
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
      setMentionDraft({ text: nextProject.goal, sequence: Date.now() });
      if (userEmail) void listProjects().then(setProjects).catch(() => undefined);
      setEvents([]);
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
        setProjects((items) => items.map((item) => item.id === restored.project.id ? { ...item, currentVersion: restored.project.currentVersion } : item));
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
          creating={creatingProject || running || restoring || switching}
          projects={projects}
          activeProjectId={identity?.projectId}
          onSelect={(id) => void switchProject(id)}
          onMention={(label) => setMentionDraft({ text: `@${label} `, sequence: Date.now() })}
          providerMode={providerMode}
          loading={!project && !loadError}
          onCreate={() => {
            setCreateError(null);
            setCreateDialogOpen(true);
          }}
          title={title}
          email={userEmail}
          onLogout={() => { void logoutUser().then(() => window.location.reload()); }}
        />
      </aside>
      <section aria-label="Agent conversation" className="conversation">
        <ConversationPanel
          mentionDraft={mentionDraft}
          canRetry={Boolean(lastFailedOperation)}
          error={loadError}
          events={events}
          runs={project?.runs ?? []}
          loading={!project && !loadError}
          messages={project?.messages ?? []}
          onRequestPlan={(request) => {
            void requestPlan(request);
          }}
          onRetry={() => {
            void retryLastFailure();
          }}
          projectGoal={goal}
          projectTitle={title}
          running={running || restoring || switching || !identity}
          status={project?.status ?? "加载中"}
        />
      </section>
      <section aria-label="Application preview" className="preview-region">
        <PreviewPanel
          key={project?.id}
          projectId={userEmail ? project?.id : undefined}
          shareToken={project?.shareToken}
          publishedVersion={project?.publishedVersion}
          onPublished={() => { if (identity) void refreshProject(identity, activeGenerationRef.current); }}
          busy={running || restoring || switching || project?.status !== "ready"}
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
    </>
  );
}
