import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ConversationPanel } from "@/components/workspace/ConversationPanel";

describe("ConversationPanel", () => {
  it("renders persisted mention messages once when the matching SSE step is present", () => {
    render(
      <ConversationPanel
        awaitingApproval={false}
        error={null}
        events={[
          {
            name: "step.completed",
            data: {
              role: "research",
              summary: "已整理目标用户和风险假设。",
            },
          },
        ]}
        loading={false}
        messages={[
          {
            id: "message-user",
            role: "user",
            kind: "user",
            content: "@研究员 请分析目标用户",
            mention: "research",
          },
          {
            id: "message-research",
            role: "research",
            kind: "assistant",
            content: "已整理目标用户和风险假设。",
          },
        ]}
        onApprove={vi.fn()}
        onRequestPlan={vi.fn()}
        projectGoal="为摄影师创建预约工具"
        projectTitle="摄影预约助手"
        running={false}
        status="ready"
      />,
    );

    expect(screen.getByText("@研究员 请分析目标用户")).toBeInTheDocument();
    expect(screen.getAllByText("已整理目标用户和风险假设。")).toHaveLength(1);
  });
});
