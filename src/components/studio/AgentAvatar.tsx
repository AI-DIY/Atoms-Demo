import type { CSSProperties } from "react";

const agents: Record<string, { name: string; color: string; symbol: string }> =
  {
    system: { name: "系统", color: "#b7b9c5", symbol: "↶" },
    leader: { name: "Mike", color: "#f5bf8c", symbol: "M" },
    pm: { name: "Emma", color: "#f7b8ce", symbol: "E" },
    architect: { name: "Bob", color: "#b8bce7", symbol: "B" },
    engineer: { name: "Alex", color: "#a6d9f4", symbol: "A" },
    research: { name: "Iris", color: "#c7b2f1", symbol: "I" },
    data: { name: "David", color: "#b3dfbe", symbol: "D" },
    seo: { name: "Sarah", color: "#ddd5ae", symbol: "S" },
    growth: { name: "Adrian", color: "#f3d88f", symbol: "A" },
    reviewer: { name: "检查", color: "#b4cbbd", symbol: "✓" },
  };
export function agentName(role: string) {
  return agents[role]?.name ?? role;
}
export function AgentAvatar({
  role,
  small = false,
}: {
  role: string;
  small?: boolean;
}) {
  const agent = agents[role] ?? { name: role, color: "#b7b9c5", symbol: "A" };
  return (
    <span
      aria-hidden
      className={`agent-face${small ? " small" : ""}`}
      style={{ "--avatar-color": agent.color } as CSSProperties}
    >
      <span className="agent-eyes" />
      <span className="agent-initial">{agent.symbol}</span>
    </span>
  );
}
