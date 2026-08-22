"use client";

import { ArrowUp, MoreHorizontal } from "lucide-react";
import { useState } from "react";
import { AgentTimeline, type TimelineEvent } from "./AgentTimeline";
import { PlanApprovalCard } from "./PlanApprovalCard";

export function ConversationPanel({
  error,
  events,
  loading,
  running,
  onApprove,
  onRequestPlan,
  projectGoal,
  projectTitle,
  status,
  awaitingApproval,
}: {
  error: string | null;
  events: TimelineEvent[];
  loading: boolean;
  running: boolean;
  onApprove: () => void;
  onRequestPlan: (request: string) => void;
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

      {error ? <p className="workspace-error" role="alert">{error}</p> : null}

      <div className="feed">
        <AgentTimeline events={events} />
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
