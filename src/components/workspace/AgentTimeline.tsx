const roleLabels: Record<string, string> = {
  leader: "团队负责人",
  pm: "产品经理",
  architect: "架构师",
  engineer: "工程师",
  reviewer: "验收检查",
};

const statusLabels: Record<string, string> = {
  "run.started": "已开始",
  "step.started": "进行中",
  "step.completed": "已完成",
  "step.failed": "失败",
  "run.awaiting_approval": "自动构建",
  "run.completed": "已完成",
  "run.failed": "失败",
};

export type TimelineEvent = {
  name: string;
  data: Record<string, unknown>;
};

type StageState = "pending" | "active" | "completed" | "failed";

const buildStages = ["规划", "构建", "验收"] as const;

function activeStageIndex(status: string, events: TimelineEvent[]) {
  if (status === "failed") {
    const lastStartedStep = [...events].reverse().find((event) => event.name === "step.started");
    const role = lastStartedStep?.data.role;

    if (role === "reviewer") return 2;
    if (role === "leader") return 0;
    return 1;
  }

  if (status === "awaiting_approval" || status === "building" || status === "iterating") return 1;
  if (status === "reviewing") return 2;
  if (status === "ready") return buildStages.length;
  return 0;
}

function stageState(index: number, activeIndex: number, status: string): StageState {
  if (status === "ready" || index < activeIndex) return "completed";
  if (index === activeIndex) return status === "failed" ? "failed" : "active";
  return "pending";
}

function stageLabel(state: StageState) {
  return {
    pending: "未开始",
    active: "进行中",
    completed: "已完成",
    failed: "失败",
  }[state];
}

function shouldShowProgress(status: string, running: boolean) {
  return running || ["planning", "awaiting_approval", "building", "reviewing", "ready", "failed", "iterating"].includes(status);
}

function displayName(event: TimelineEvent) {
  const role = event.data.role;

  if (typeof role === "string") {
    return roleLabels[role] ?? role;
  }

  return event.name.startsWith("run.") ? "团队运行" : "团队成员";
}

function eventSummary(event: TimelineEvent) {
  return typeof event.data.summary === "string" ? event.data.summary : null;
}

export function AgentTimeline({
  events,
  running = false,
  status = "draft",
}: {
  events: TimelineEvent[];
  running?: boolean;
  status?: string;
}) {
  const activeIndex = activeStageIndex(status, events);

  return (
    <section aria-label="智能体运行时间线" className="agent-timeline">
      <p className="feed-heading">团队运行记录</p>
      {shouldShowProgress(status, running) ? (
        <section aria-label="构建进度" className="build-progress">
          <p className="build-progress-title" role="status">当前阶段：{buildStages[Math.min(activeIndex, buildStages.length - 1)]}{status === "ready" ? "已完成" : status === "failed" ? "失败" : "进行中"}</p>
          <ol className="build-progress-list">
            {buildStages.map((stage, index) => {
              const state = stageState(index, activeIndex, status);

              return (
                <li className={`build-progress-stage is-${state}`} key={stage}>
                  <span aria-hidden className="build-progress-marker" />
                  <span className="build-progress-copy"><strong>{stage}</strong><small>{stageLabel(state)}</small></span>
                </li>
              );
            })}
          </ol>
        </section>
      ) : null}
      {events.length === 0 ? (
        <p className="timeline-empty">提交目标后将在这里显示团队进度。</p>
      ) : (
        <ol className="timeline-list">
          {events.map((event, index) => (
            <li
              className="timeline-row"
              key={event.name + "-" + index}
            >
              <span aria-hidden className="timeline-marker" />
              <div className="timeline-copy">
                <div className="timeline-heading">
                  <strong>{displayName(event)}</strong>
                  <span>{statusLabels[event.name] ?? "已更新"}</span>
                </div>
                {eventSummary(event) ? (
                  <p>{eventSummary(event)}</p>
                ) : null}
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
