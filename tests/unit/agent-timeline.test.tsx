import { render, screen } from "@testing-library/react";
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
});
