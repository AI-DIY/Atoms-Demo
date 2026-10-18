"use client";

import { ArrowUp } from "lucide-react";
import { useEffect, useLayoutEffect, useState } from "react";
import type { ProjectMessage, ProjectRun } from "@/lib/client-api";
import { roles } from "@/lib/roles";
import { AgentTimeline, type TimelineEvent } from "./AgentTimeline";

function timelineEventsWithoutPersistedSummaries(
  events: TimelineEvent[],
  messages: ProjectMessage[],
) {
  return events.map((event) => {
    const summary = event.data.summary;
    const isPersistedSummary = event.name === "step.completed"
      && typeof summary === "string"
      && typeof event.data.role === "string"
      && messages.some(
        (message) => message.role === event.data.role && message.content === summary,
      );

    return isPersistedSummary
      ? { ...event, data: { ...event.data, summary: undefined } }
      : event;
  });
}

function messageRoleLabel(role: string) {
  if (role === "user") return "你";
  if (role === "system") return "系统";
  return roles.find((item) => item.id === role)?.label ?? (role === "reviewer" ? "验收检查" : "专家");
}

function mentionCandidates(request: string) {
  const match = request.match(/(?:^|\s)@([^\s，,。.!！?？]*)$/u);

  if (!match) {
    return [];
  }

  const query = match[1].toLocaleLowerCase();

  return roles.filter((role) =>
    role.label.toLocaleLowerCase().startsWith(query)
    || role.aliases.some((alias) => alias.toLocaleLowerCase().startsWith(query)),
  );
}

export function ConversationPanel({
  error,
  events,
  loading,
  messages,
  running,
  onRequestPlan,
  onRetry,
  projectGoal,
  projectTitle,
  status,
  canRetry = true,
  mentionDraft,
  runs = [],
}: {
  error: string | null;
  events: TimelineEvent[];
  loading: boolean;
  messages: ProjectMessage[];
  running: boolean;
  onRequestPlan: (request: string) => void;
  onRetry: (request: string) => void;
  projectGoal: string;
  projectTitle: string;
  status: string;
  canRetry?: boolean;
  mentionDraft?: { text: string; sequence: number };
  runs?: ProjectRun[];
}) {
  const [request, setRequest] = useState<string | null>(null);
  const isEditingCurrentResult = status === "ready";
  const requestLabel = isEditingCurrentResult ? "描述希望修改的内容" : "描述你要构建的产品";
  const submitLabel = isEditingCurrentResult ? "修改当前成果" : "制定团队计划";
  const activeRequest = request ?? (isEditingCurrentResult ? "" : projectGoal);
  const candidates = mentionCandidates(activeRequest);

  useEffect(() => { if (mentionDraft) setRequest(mentionDraft.text); }, [mentionDraft]);

  useLayoutEffect(() => {
    if (isEditingCurrentResult) {
      setRequest("");
    }
  }, [isEditingCurrentResult]);

  function selectMention(roleLabel: string) {
    setRequest(activeRequest.replace(/@[^\s，,。.!！?？]*$/u, `@${roleLabel} `));
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRequest = activeRequest.trim();

    if (nextRequest) {
      onRequestPlan(nextRequest);
    }
  }

  const statusText: Record<string, string> = {
    draft: "草稿",
    planning: "制定计划",
    awaiting_approval: "构建中",
    building: "构建中",
    reviewing: "验收中",
    ready: "已就绪",
    failed: "运行失败",
    iterating: "迭代中",
  };
  const timelineEvents = timelineEventsWithoutPersistedSummaries(events, messages);

  return (
    <div className="conversation">
      <header className="conversation-header">
        <div>
          <p className="eyebrow">当前工作区</p>
          <h2 className="conversation-title">从目标到可运行应用</h2>
        </div>
        <span className="workspace-badge">BUILD WITH AGENTS</span>
      </header>

      <div className="goal-card">
        <div className="goal-card-top">
          <span>项目目标</span>
          <span className="goal-tag">{loading ? "加载中" : statusText[status] ?? status}</span>
        </div>
        <h1>{projectGoal}</h1>
        <p>{projectTitle}</p>
      </div>

      {error ? (
        <div className="workspace-error">
          <p role="alert">{error}</p>
          {canRetry ? (
            <button disabled={running} onClick={() => onRetry(activeRequest.trim())} type="button">
              {running ? "重试中" : "重试"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div className="feed">
        {runs.some((run) => run.steps?.some((step) => step.artifactJson && step.artifactType !== "app")) ? <details className="artifact-details"><summary>查看团队交付文档</summary>{runs.slice(0, 5).flatMap((run) => (run.steps ?? []).filter((step) => step.artifactJson && step.artifactType !== "app").map((step, index) => <details key={`${run.id}-${index}`}><summary>{messageRoleLabel(step.role)} · {step.inputSummary}</summary><pre>{(() => { try { return JSON.stringify(JSON.parse(step.artifactJson!), null, 2); } catch { return step.artifactJson; } })()}</pre></details>))}</details> : null}
        {messages.length > 0 ? (
          <ol className="message-list" style={{ listStyle: "none", margin: 0, padding: 0 }}>
            {messages.map((message) => (
              <li key={message.id} style={{ borderTop: "1px solid #252b27", padding: "10px 0" }}>
                <strong>{messageRoleLabel(message.role)}</strong>
                <p style={{ margin: "4px 0 0" }}>{message.content}</p>
              </li>
            ))}
          </ol>
        ) : null}
        <AgentTimeline events={timelineEvents} running={running} status={status} />
      </div>

      <form className="composer" onSubmit={submit}>
        <div className="composer-box">
          {candidates.length > 0 ? (
            <div aria-label="@ 专家建议" className="mention-menu" role="listbox">
              {candidates.map((role) => (
                <button
                  aria-label={`@${role.label}`}
                  key={role.id}
                  onClick={() => selectMention(role.label)}
                  role="option"
                  aria-selected={false}
                  type="button"
                >
                  <strong>@{role.label}</strong>
                  <span>{role.aliases[0]}</span>
                </button>
              ))}
            </div>
          ) : null}
          <textarea
            aria-label={requestLabel}
            onChange={(event) => setRequest(event.target.value)}
            placeholder={requestLabel}
            rows={2}
            maxLength={2000}
            value={activeRequest}
          />
          <button
            className="send-button"
            disabled={running || loading}
            style={{
              alignItems: "center",
              display: "inline-flex",
              gap: 6,
              justifyContent: "center",
              minWidth: 140,
              padding: "0 12px",
              width: "auto",
            }}
            type="submit"
          >
            <ArrowUp aria-hidden />
            <span>{submitLabel}</span>
          </button>
        </div>
        <p className="composer-help">{isEditingCurrentResult ? "输入意见后将基于当前成果生成新版本" : "@ 专家直接咨询；按目标发起团队协作"}</p>
      </form>
    </div>
  );
}
