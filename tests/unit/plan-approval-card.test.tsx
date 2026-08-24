import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AgentTimeline } from "@/components/workspace/AgentTimeline";
import { PlanApprovalCard } from "@/components/workspace/PlanApprovalCard";

describe("PlanApprovalCard", () => {
  afterEach(() => {
    cleanup();
  });

  it("只在点击开始构建后审批", () => {
    const onApprove = vi.fn();

    render(
      <PlanApprovalCard
        roles={["pm", "architect", "engineer"]}
        onApprove={onApprove}
      />,
    );

    expect(onApprove).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "开始构建" }));

    expect(onApprove).toHaveBeenCalledOnce();
  });

  it("以稳定状态行展示运行事件", () => {
    render(
      <AgentTimeline
        events={[
          {
            name: "step.completed",
            data: { role: "pm" },
          },
        ]}
      />,
    );

    expect(screen.getByLabelText("智能体运行时间线")).toBeInTheDocument();
    expect(screen.getByText("产品经理")).toBeInTheDocument();
    expect(screen.getByText("已完成")).toBeInTheDocument();
  });

  it("shows the real team build stage while preserving the execution history", () => {
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
    expect(progress).toBeInTheDocument();
    expect(within(progress).getByText("规划")).toBeInTheDocument();
    expect(within(progress).getByText("构建")).toBeInTheDocument();
    expect(within(progress).getByText("进行中")).toBeInTheDocument();
    expect(screen.getByLabelText("智能体运行时间线")).toHaveTextContent("工程师");
  });
});
