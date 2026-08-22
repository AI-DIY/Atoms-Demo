"use client";

import { ArrowUp, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import type { ProjectMessage } from "@/lib/client-api";
import { AgentTimeline, type TimelineEvent } from "./AgentTimeline";
import { PlanApprovalCard } from "./PlanApprovalCard";

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
  return "专家";
}

export function ConversationPanel({
  error,
  events,
  loading,
  messages,
  running,
  onApprove,
  onRequestPlan,
  onRetry,
  projectGoal,
  projectTitle,
  status,
  awaitingApproval,
}: {
  error: string | null;
  events: TimelineEvent[];
  loading: boolean;
  messages: ProjectMessage[];
  running: boolean;
  onApprove: () => void;
  onRequestPlan: (request: string) => void;
  onRetry: (request: string) => void;
  projectGoal: string;
  projectTitle: string;
  status: string;
  awaitingApproval: boolean;
}) {
  const [request, setRequest] = useState(projectGoal);

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRequest = request.trim();

    if (nextRequest) {
      onRequestPlan(nextRequest);
    }
  }

  const statusText: Record<string, string> = {
    draft: "草稿",
    planning: "制定计划",
    awaiting_approval: "等待审批",
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
        <button className="small-button" title="更多项目操作" type="button">
          <MoreHorizontal aria-hidden />
        </button>
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
          <button disabled={running} onClick={() => onRetry(request.trim())} type="button">
            重试
          </button>
        </div>
      ) : null}

      <div className="feed">
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
        <AgentTimeline events={timelineEvents} />
        {awaitingApproval ? (
          <PlanApprovalCard
            disabled={running}
            onApprove={onApprove}
            roles={["pm", "architect", "engineer"]}
          />
        ) : null}
      </div>

      <form className="composer" onSubmit={submit}>
        <div className="composer-box">
          <textarea
            aria-label="描述你要构建的产品"
            onChange={(event) => setRequest(event.target.value)}
            placeholder="描述你要构建的产品"
            rows={2}
            value={request}
          />
          <button
            className="send-button"
            disabled={running}
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
            <span>制定团队计划</span>
          </button>
        </div>
        <p className="composer-help">@ 专家直接咨询；按目标发起团队协作</p>
      </form>
    </div>
  );
}
