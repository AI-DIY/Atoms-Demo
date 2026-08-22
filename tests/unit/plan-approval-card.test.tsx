import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AgentTimeline } from "@/components/workspace/AgentTimeline";
import { PlanApprovalCard } from "@/components/workspace/PlanApprovalCard";

describe("PlanApprovalCard", () => {
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
});
