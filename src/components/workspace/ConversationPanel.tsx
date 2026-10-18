"use client";

import { ArrowUp, Check, Copy, FileText, Sparkles } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { AgentAvatar, agentName } from "@/components/studio/AgentAvatar";
import { copyText } from "@/lib/clipboard";
import type { ProjectMessage, ProjectRun } from "@/lib/client-api";
import { roles } from "@/lib/roles";
import { AgentTimeline, type TimelineEvent } from "./AgentTimeline";

function timelineEventsWithoutPersistedSummaries(
  events: TimelineEvent[],
  messages: ProjectMessage[],
) {
  return events.map((event) => {
    const summary = event.data.summary;
    const isPersistedSummary =
      event.name === "step.completed" &&
      typeof summary === "string" &&
      typeof event.data.role === "string" &&
      messages.some(
        (message) =>
          message.role === event.data.role && message.content === summary,
      );

    return isPersistedSummary
      ? { ...event, data: { ...event.data, summary: undefined } }
      : event;
  });
}

function messageRoleLabel(role: string) {
  if (role === "user") return "你";
  if (role === "system") return "系统";
  return (
    roles.find((item) => item.id === role)?.label ??
    (role === "reviewer" ? "验收检查" : "专家")
  );
}

function mentionCandidates(request: string) {
  const match = request.match(/(?:^|\s)@([^\s，,。.!！?？]*)$/u);

  if (!match) {
    return [];
  }

  const query = match[1].toLocaleLowerCase();

  return roles.filter(
    (role) =>
      role.label.toLocaleLowerCase().startsWith(query) ||
      role.aliases.some((alias) => alias.toLocaleLowerCase().startsWith(query)),
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
  compact = false,
  pendingMessage = "",
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
  compact?: boolean;
  pendingMessage?: string;
}) {
  const [request, setRequest] = useState<string | null>(null);
  const isEditingCurrentResult = status === "ready";
  const requestLabel = isEditingCurrentResult
    ? "描述希望修改的内容"
    : "描述你要构建的产品";
  const submitLabel = isEditingCurrentResult ? "修改当前成果" : "制定团队计划";
  const activeRequest = request ?? (isEditingCurrentResult ? "" : projectGoal);
  const candidates = mentionCandidates(activeRequest);
  const feedRef = useRef<HTMLDivElement>(null);
  const followBottom = useRef(true);
  const [copied, setCopied] = useState("");
  const [copyError, setCopyError] = useState("");
  useEffect(() => {
    if (followBottom.current && feedRef.current)
      feedRef.current.scrollTop = feedRef.current.scrollHeight;
  }, [messages.length, events.length, pendingMessage]);

  useEffect(() => {
    if (mentionDraft) setRequest(mentionDraft.text);
  }, [mentionDraft]);

  useLayoutEffect(() => {
    if (isEditingCurrentResult) {
      setRequest("");
    }
  }, [isEditingCurrentResult]);

  function selectMention(roleLabel: string) {
    setRequest(
      activeRequest.replace(/@[^\s，,。.!！?？]*$/u, `@${roleLabel} `),
    );
  }

  function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextRequest = activeRequest.trim();

    if (nextRequest) {
      followBottom.current = true;
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
  const timelineEvents = timelineEventsWithoutPersistedSummaries(
    events,
    messages,
  );

  return (
    <div className="conversation">
      {!compact ? (
        <>
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
              <span className="goal-tag">
                {loading ? "加载中" : (statusText[status] ?? status)}
              </span>
            </div>
            <h1>{projectGoal}</h1>
            <p>{projectTitle}</p>
          </div>
        </>
      ) : (
        <details className="project-brief">
          <summary>
            <span>项目目标</span>
            <span className={`status-dot status-${status}`}>
              {loading ? "加载中" : (statusText[status] ?? status)}
            </span>
          </summary>
          <p>{projectGoal}</p>
        </details>
      )}

      {error ? (
        <div className="workspace-error">
          <p role="alert">{error}</p>
          {canRetry ? (
            <button
              disabled={running}
              onClick={() => onRetry(activeRequest.trim())}
              type="button"
            >
              {running ? "重试中" : "重试"}
            </button>
          ) : null}
        </div>
      ) : null}

      <div
        className="feed"
        ref={feedRef}
        onScroll={() => {
          const el = feedRef.current;
          if (el)
            followBottom.current =
              el.scrollHeight - el.scrollTop - el.clientHeight < 100;
        }}
      >
        {!messages.length && !pendingMessage && !running ? (
          <div className="conversation-welcome">
            <AgentAvatar role="leader" />
            <h3>一起把想法变成现实</h3>
            <p>
              描述你想解决的问题。团队会规划需求、设计结构、生成代码，你可以随时通过
              @ 咨询一位专家。
            </p>
            <span>
              <Sparkles size={13} /> 你的第一步，只需要一句话
            </span>
          </div>
        ) : null}
        {messages.length > 0 ? (
          <ol
            className="message-list"
            style={{ listStyle: "none", margin: 0, padding: 0 }}
          >
            {messages.map((message) => (
              <li
                key={message.id}
                className={`chat-message ${message.role === "user" ? "from-user" : "from-agent"}`}
              >
                {message.role !== "user" ? (
                  <div className="message-identity">
                    <AgentAvatar role={message.role} small />
                    <strong>{agentName(message.role)}</strong>
                    <span>{messageRoleLabel(message.role)}</span>
                  </div>
                ) : null}
                <div className="message-content">
                  <MessageText text={message.content} />
                </div>
                {message.role !== "user" ? (
                  <button
                    className="icon-button message-copy"
                    aria-label={`复制${messageRoleLabel(message.role)}回复`}
                    onClick={() =>
                      void copyText(message.content)
                        .then(() => {
                          setCopied(message.id);
                          setCopyError("");
                        })
                        .catch(() =>
                          setCopyError("复制失败，请手动选择文本复制。"),
                        )
                    }
                  >
                    {copied === message.id ? (
                      <Check size={14} />
                    ) : (
                      <Copy size={14} />
                    )}
                  </button>
                ) : null}
              </li>
            ))}
          </ol>
        ) : null}
        {pendingMessage &&
        !messages.some(
          (m) => m.role === "user" && m.content === pendingMessage,
        ) ? (
          <div className="chat-message from-user">
            <div className="message-content">
              <MessageText text={pendingMessage} />
            </div>
          </div>
        ) : null}
        {copyError ? (
          <p role="status" className="form-error">
            {copyError}
          </p>
        ) : null}
        {runs.some((run) =>
          run.steps?.some(
            (step) => step.artifactJson && step.artifactType !== "app",
          ),
        ) ? (
          <details className="artifact-details">
            <summary>
              <FileText size={15} />
              查看团队交付文档
            </summary>
            {runs.slice(0, 10).flatMap((run) =>
              (run.steps ?? [])
                .filter(
                  (step) => step.artifactJson && step.artifactType !== "app",
                )
                .map((step, index) => (
                  <details key={`${run.id}-${index}`}>
                    <summary>
                      {messageRoleLabel(step.role)} ·{" "}
                      {artifactTitles[step.artifactType ?? ""] ?? "工作成果"}
                    </summary>
                    <ArtifactDocument json={step.artifactJson!} />
                  </details>
                )),
            )}
          </details>
        ) : null}
        {compact ? (
          events.length || running ? (
            <details className="run-details" open={running}>
              <summary>
                {running ? (
                  <span className="working-dot" />
                ) : (
                  <Check size={14} />
                )}{" "}
                {running ? "团队正在处理" : "本次运行已结束"} ·{" "}
                {events.filter((e) => e.name === "step.completed").length}{" "}
                个步骤
              </summary>
              <AgentTimeline
                events={timelineEvents}
                running={running}
                status={status}
              />
            </details>
          ) : null
        ) : (
          <AgentTimeline
            events={timelineEvents}
            running={running}
            status={status}
          />
        )}
      </div>

      <form className="composer" onSubmit={submit}>
        <div className="composer-box">
          {candidates.length > 0 ? (
            <div
              aria-label="@ 专家建议"
              className="mention-menu"
              role="listbox"
            >
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
          <div className="composer-bottom">
            <button
              className="mention-trigger"
              type="button"
              aria-label="选择专家"
              onClick={() =>
                setRequest(activeRequest.trim() ? activeRequest + " @" : "@")
              }
            >
              @ <span>咨询专家</span>
            </button>
            <button
              className="send-button"
              disabled={running || loading || !activeRequest.trim()}
              aria-label={submitLabel}
              title={submitLabel}
              type="submit"
            >
              <ArrowUp aria-hidden />
              <span className="sr-only">{submitLabel}</span>
            </button>
          </div>
        </div>
        <p className="composer-help">
          {isEditingCurrentResult
            ? "输入意见后将基于当前成果生成新版本"
            : "@ 专家直接咨询；按目标发起团队协作"}
        </p>
      </form>
    </div>
  );
}

const artifactTitles: Record<string, string> = {
  plan: "团队计划",
  prd: "产品需求",
  architecture: "应用架构",
  research: "研究建议",
  analysis: "数据分析",
  seo: "搜索优化",
  growth: "增长实验",
};
const fieldNames: Record<string, string> = {
  roles: "参与角色",
  risks: "风险与边界",
  users: "目标用户",
  scope: "功能范围",
  flow: "用户流程",
  acceptance: "验收标准",
  pages: "页面结构",
  state: "数据状态",
  constraints: "实现约束",
  findings: "研究发现",
  assumptions: "待验证假设",
  metrics: "核心指标",
  questions: "分析问题",
  keywords: "关键词",
  recommendations: "建议",
  experiments: "实验方案",
  successMetric: "成功指标",
};
function ArtifactDocument({ json }: { json: string }) {
  let value: unknown;
  try {
    value = JSON.parse(json);
  } catch {
    return <p>{json}</p>;
  }
  if (!value || typeof value !== "object" || Array.isArray(value))
    return <p>{json}</p>;
  return (
    <div className="artifact-document">
      {Object.entries(value).map(([key, items]) => (
        <section key={key}>
          <h4>{fieldNames[key] ?? key}</h4>
          {Array.isArray(items) ? (
            <ul>
              {items.map((item, i) => (
                <li key={i}>
                  {typeof item === "string"
                    ? key === "roles"
                      ? messageRoleLabel(item)
                      : item
                    : JSON.stringify(item)}
                </li>
              ))}
            </ul>
          ) : (
            <p>{String(items)}</p>
          )}
        </section>
      ))}
    </div>
  );
}
function MessageText({ text }: { text: string }) {
  const displayText = text.replace(/^Restored version V(\d+)$/, "已恢复到 V$1。业务数据和已发布版本保持不变。");
  return (
    <>
      {displayText.split("\n").map((line, i) => (
        <p key={i}>
          {line
            .split(/(\*\*[^*]+\*\*)/g)
            .map((part, j) =>
              part.startsWith("**") && part.endsWith("**") ? (
                <strong key={j}>{part.slice(2, -2)}</strong>
              ) : (
                part
              ),
            ) || "\u00a0"}
        </p>
      ))}
    </>
  );
}
