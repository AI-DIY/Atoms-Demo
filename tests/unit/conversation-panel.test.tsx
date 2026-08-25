import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ConversationPanel } from "@/components/workspace/ConversationPanel";

describe("ConversationPanel", () => {
  afterEach(() => {
    cleanup();
  });

  it("renders persisted mention messages once when the matching SSE step is present", () => {
    render(
      <ConversationPanel
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
        onRequestPlan={vi.fn()}
        onRetry={vi.fn()}
        projectGoal="为摄影师创建预约工具"
        projectTitle="摄影预约助手"
        running={false}
        status="ready"
      />,
    );

    expect(screen.getByText("@研究员 请分析目标用户")).toBeInTheDocument();
    expect(screen.getAllByText("已整理目标用户和风险假设。")).toHaveLength(1);
  });

  it("keeps the request available for an accessible retry after an error", () => {
    const onRetry = vi.fn();
    render(
      <ConversationPanel
        error="服务器正忙，请稍后重试。"
        events={[]}
        loading={false}
        messages={[]}
        onRequestPlan={vi.fn()}
        onRetry={onRetry}
        projectGoal="为摄影师创建预约工具"
        projectTitle="摄影预约助手"
        running={false}
        status="failed"
      />,
    );

    const request = screen.getByRole("textbox", { name: "描述你要构建的产品" });
    fireEvent.change(request, { target: { value: "改为支持报价跟进" } });
    fireEvent.click(screen.getByRole("button", { name: "重试" }));

    expect(screen.getByRole("alert")).toHaveTextContent("服务器正忙，请稍后重试。");
    expect(onRetry).toHaveBeenCalledWith("改为支持报价跟进");
  });

  it("offers matching experts after an @ and inserts the selected mention", () => {
    const onRequestPlan = vi.fn();
    render(
      <ConversationPanel
        error={null}
        events={[]}
        loading={false}
        messages={[]}
        onRequestPlan={onRequestPlan}
        onRetry={vi.fn()}
        projectGoal="为摄影师创建预约工具"
        projectTitle="摄影预约助手"
        running={false}
        status="draft"
      />,
    );

    const request = screen.getByRole("textbox", { name: "描述你要构建的产品" });
    fireEvent.change(request, { target: { value: "@研" } });

    fireEvent.click(screen.getByRole("option", { name: "@研究员" }));
    expect(request).toHaveValue("@研究员 ");

    fireEvent.click(screen.getByRole("button", { name: "制定团队计划" }));
    expect(onRequestPlan).toHaveBeenCalledWith("@研究员");
  });

});
