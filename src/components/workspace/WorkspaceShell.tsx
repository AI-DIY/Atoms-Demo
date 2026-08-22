"use client";

import { useEffect, useState } from "react";
import {
  approveRun,
  createProject,
  loadProject,
  startRun,
  type LoadedProject,
  type ProjectIdentity,
} from "@/lib/client-api";
import { defaultProject } from "@/lib/default-project";
import {
  readProjectIdentity,
  restoreOrCreateProject,
} from "@/lib/project-session";
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

function statusForEvent(name: string, payload: Record<string, unknown>): LoadedProject["status"] | null {
  if (name === "run.started") {
    return "planning";
  }

  if (name === "step.started") {
    return payload.role === "leader" ? "planning" : "building";
  }

  if (name === "run.awaiting_approval") {
    return "awaiting_approval";
  }

  if (name === "run.completed") {
    return "ready";
  }

  if (name === "step.failed" || name === "run.failed") {
    return "failed";
  }

  return null;
}

export function WorkspaceShell() {
  const [identity, setIdentity] = useState<ProjectIdentity | null>(null);
  const [project, setProject] = useState<LoadedProject | null>(null);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [approvalRunId, setApprovalRunId] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

  async function refreshProject(activeIdentity: ProjectIdentity) {
    const refreshed = await loadProject(activeIdentity);
    setProject(refreshed);
  }

  function receiveEvent(name: string, data: unknown) {
    const payload = eventData(data);
    setEvents((current) => [...current, { name, data: payload }]);
    const nextStatus = statusForEvent(name, payload);

    if (nextStatus) {
      setProject((current) => current ? { ...current, status: nextStatus } : current);
    }

    if (name === "run.awaiting_approval" && typeof payload.runId === "string") {
      setApprovalRunId(payload.runId);
    }

    if (name === "run.completed" && typeof payload.versionId === "string" && identity) {
      setApprovalRunId(null);
      void refreshProject(identity).catch(() => {
        setLoadError("版本已生成，但项目刷新失败，请刷新页面后重试。");
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

  async function requestPlan(request: string) {
    if (!identity) {
      return;
    }

    setLoadError(null);
    setEvents([]);
    setApprovalRunId(null);

    try {
      await startRun(
        identity.projectId,
        identity.ownerToken,
        { mode: "team", request },
        receiveEvent,
      );
    } catch {
      setLoadError("制定团队计划失败，请稍后重试。");
    }
  }

  async function approvePlan() {
    if (!identity || !approvalRunId) {
      return;
    }

    setLoadError(null);

    try {
      await approveRun(
        identity.projectId,
        identity.ownerToken,
        approvalRunId,
        receiveEvent,
      );
    } catch {
      setLoadError("开始构建失败，请稍后重试。");
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
          onApprove={approvePlan}
          onRequestPlan={requestPlan}
          projectGoal={goal}
          projectTitle={title}
          status={project?.status ?? "加载中"}
        />
      </section>
      <section aria-label="Application preview" className="preview-region">
        <PreviewPanel
          currentVersion={project?.currentVersion ?? 0}
          projectTitle={title}
          versions={project?.versions ?? []}
        />
      </section>
    </main>
  );
}
