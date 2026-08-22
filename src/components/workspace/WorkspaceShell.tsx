"use client";

import { useEffect, useRef, useState } from "react";
import {
  approveRun,
  createProject,
  loadProject,
  restoreVersion,
  startRun,
  type LoadedProject,
  type ProjectIdentity,
} from "@/lib/client-api";
import { defaultProject } from "@/lib/default-project";
import {
  readProjectIdentity,
  restoreOrCreateProject,
} from "@/lib/project-session";
import { parseFirstMention } from "@/lib/mention";
import { ConversationPanel } from "./ConversationPanel";
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

type RunMode = "team" | "mention" | "iterate";

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

export function WorkspaceShell() {
  const [identity, setIdentity] = useState<ProjectIdentity | null>(null);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [approvalRunId, setApprovalRunId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [running, setRunning] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreError, setRestoreError] = useState<string | null>(null);
  const activeGenerationRef = useRef(0);
  const generationRef = useRef(0);
  const runActiveRef = useRef(false);
  const restoreActiveRef = useRef(false);

  async function refreshProject(activeIdentity: ProjectIdentity, generation: number) {
    const refreshed = await loadProject(activeIdentity);

    if (generation === activeGenerationRef.current) {
      setProject(refreshed);
    }
  }

  function receiveEvent(
    generation: number,
    mode: RunMode,
    name: string,
    data: unknown,
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
      setApprovalRunId(payload.runId);
    }

    if (name === "run.completed") {
      setApprovalRunId(null);
    }

    if ((name === "run.awaiting_approval" || name === "run.completed") && identity) {
      void refreshProject(identity, generation).catch(() => {
        if (generation === activeGenerationRef.current) {
          setLoadError("项目状态已更新，但项目刷新失败，请刷新页面后重试。");
        }
      });
    }

    if (name === "run.failed") {
      setApprovalRunId(null);
      const error = typeof payload.error === "string" ? payload.error : "团队运行失败，请重试。";
      setLoadError(error);
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
          setApprovalRunId(latestAwaitingTeamRunId(loadedProject));
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

  async function requestPlan(request: string, preserveHistory = false) {
    if (!identity || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    runActiveRef.current = true;
    setRunning(true);
    setLoadError(null);
    if (!preserveHistory) {
      setEvents([]);
      setApprovalRunId(null);
    }
    const mode: RunMode = parseFirstMention(request)
      ? "mention"
      : project?.status === "ready"
        ? "iterate"
        : "team";

    try {
      await startRun(
        identity.projectId,
        identity.ownerToken,
        { mode, request },
        (name, data) => receiveEvent(generation, mode, name, data),
      );
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setLoadError(error instanceof Error ? error.message : "制定团队计划失败，请稍后重试。");
      }
    } finally {
      if (generation === activeGenerationRef.current) {
        runActiveRef.current = false;
        setRunning(false);
      }
    }
  }

  async function approvePlan() {
    if (!identity || !approvalRunId || runActiveRef.current || restoreActiveRef.current) {
      return;
    }

    const generation = ++generationRef.current;
    activeGenerationRef.current = generation;
    runActiveRef.current = true;
    setRunning(true);
    setLoadError(null);

    try {
      await approveRun(
        identity.projectId,
        identity.ownerToken,
        approvalRunId,
        (name, data) => receiveEvent(generation, "team", name, data),
      );
    } catch (error) {
      if (generation === activeGenerationRef.current) {
        setLoadError(error instanceof Error ? error.message : "开始构建失败，请稍后重试。");
      }
    } finally {
      if (generation === activeGenerationRef.current) {
        runActiveRef.current = false;
        setRunning(false);
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
    <main className="workspace">
      <aside aria-label="Projects" className="sidebar">
        <ProjectSidebar loading={!project && !loadError} title={title} />
      </aside>
      <section aria-label="Agent conversation" className="conversation">
        <ConversationPanel
          awaitingApproval={Boolean(approvalRunId)}
          error={loadError}
          events={events}
          loading={!project && !loadError}
          messages={project?.messages ?? []}
          onApprove={approvePlan}
          onRequestPlan={(request) => {
            void requestPlan(request);
          }}
          onRetry={(request) => {
            void requestPlan(request, true);
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
  );
}
