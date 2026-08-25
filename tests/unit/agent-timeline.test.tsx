import { render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { AgentTimeline } from "@/components/workspace/AgentTimeline";

describe("AgentTimeline", () => {
  it("shows a specialist completion summary in the conversation timeline", () => {
    render(
      <AgentTimeline
        events={[
          {
            name: "step.completed",
            data: {
              role: "research",
              summary: "已整理目标用户和风险假设。",
            },
          },
        ]}
      />,
    );

    expect(screen.getByText("已整理目标用户和风险假设。")).toBeInTheDocument();
  });

  it("shows automatic build stages without an approval stage", () => {
    render(
      <AgentTimeline
        events={[
          { name: "run.started", data: {} },
          { name: "step.completed", data: { role: "leader" } },
          { name: "step.started", data: { role: "engineer" } },
        ]}
        running
        status="building"
      />,
    );

    const progress = screen.getByLabelText("构建进度");
    expect(within(progress).getByText("规划")).toBeInTheDocument();
    expect(within(progress).getByText("构建")).toBeInTheDocument();
    expect(within(progress).getByText("验收")).toBeInTheDocument();
    expect(within(progress).queryByText("审批")).not.toBeInTheDocument();
  });

  it("replaces a role's running entry with its completed terminal state", () => {
    const { container } = render(
      <AgentTimeline
        events={[
          { name: "step.started", data: { role: "leader" } },
          { name: "step.completed", data: { role: "leader", summary: "计划已完成。" } },
          { name: "run.completed", data: {} },
        ]}
        status="ready"
      />,
    );

    const timeline = within(container).getByLabelText("智能体运行时间线");
    expect(within(timeline).getAllByText("团队负责人")).toHaveLength(1);
    expect(within(timeline).queryByText("进行中")).not.toBeInTheDocument();
    expect(within(timeline).getByText("计划已完成。").parentElement).toHaveTextContent("已完成");
  });
});
