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
  "run.awaiting_approval": "等待审批",
  "run.completed": "已完成",
  "run.failed": "失败",
};

export type TimelineEvent = {
  name: string;
  data: Record<string, unknown>;
};

function displayName(event: TimelineEvent) {
  const role = event.data.role;

  if (typeof role === "string") {
    return roleLabels[role] ?? role;
  }

  return event.name.startsWith("run.") ? "团队运行" : "团队成员";
}

export function AgentTimeline({ events }: { events: TimelineEvent[] }) {
  return (
    <section aria-label="智能体运行时间线" className="agent-timeline" style={{ minHeight: 178 }}>
      <p className="feed-heading">团队运行记录</p>
      {events.length === 0 ? (
        <p className="timeline-empty" style={{ minHeight: 144 }}>提交目标后将在这里显示团队进度。</p>
      ) : (
        <ol className="timeline-list" style={{ minHeight: 144, margin: 0, padding: 0, listStyle: "none" }}>
          {events.map((event, index) => (
            <li
              className="timeline-row"
              key={event.name + "-" + index}
              style={{
                alignItems: "center",
                borderTop: "1px solid #252b27",
                display: "grid",
                gap: 9,
                gridTemplateColumns: "14px 1fr",
                minHeight: 36,
              }}
            >
              <span
                aria-hidden
                className="timeline-marker"
                style={{
                  background: "#1e2c20",
                  border: "1px solid var(--lime)",
                  borderRadius: "50%",
                  height: 7,
                  width: 7,
                }}
              />
              <div
                className="timeline-copy"
                style={{
                  alignItems: "baseline",
                  display: "flex",
                  justifyContent: "space-between",
                  minWidth: 0,
                }}
              >
                <strong style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{displayName(event)}</strong>
                <span style={{ color: "var(--muted)", fontSize: 10, whiteSpace: "nowrap" }}>{statusLabels[event.name] ?? "已更新"}</span>
              </div>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
