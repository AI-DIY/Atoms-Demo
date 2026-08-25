import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const dependencies = vi.hoisted(() => {
  let busy = false;
  const gate = {
    async acquire() {
      if (busy) {
        throw new Error("Server is busy");
      }

      busy = true;
      let released = false;

      return () => {
        if (!released) {
          released = true;
          busy = false;
        }
      };
    },
    isBusy() {
      return busy;
    },
    reset() {
      busy = false;
    },
  };

  return {
    allowModelStart: vi.fn(() => true),
    claimRunForApproval: vi.fn(),
    getAgentProvider: vi.fn(),
    getRun: vi.fn(),
    gate,
  };
});

vi.mock("@/lib/env", () => ({ getAgentProvider: dependencies.getAgentProvider }));
vi.mock("@/lib/execution-limits", () => ({
  allowModelStart: dependencies.allowModelStart,
  teamGenerationGate: dependencies.gate,
}));
vi.mock("@/lib/repository", () => ({
  appendMessage: vi.fn(),
  claimRunForApproval: dependencies.claimRunForApproval,
  completeRun: vi.fn(),
  createRunStep: vi.fn(),
  createVersion: vi.fn(),
  getRun: dependencies.getRun,
  updateProjectStatus: vi.fn(),
}));

import { POST } from "@/app/api/projects/[projectId]/runs/[runId]/approve/route";

const planJson = JSON.stringify({
  goal: "为摄影师创建预约与报价工具",
  artifact: {
    type: "plan",
    content: {
      roles: ["pm", "architect", "engineer"],
      risks: ["需要确认流程"],
    },
  },
});

describe("approve run route", () => {
  beforeEach(() => {
    dependencies.gate.reset();
    dependencies.allowModelStart.mockReset();
    dependencies.allowModelStart.mockReturnValue(true);
    dependencies.claimRunForApproval.mockReset();
    dependencies.getAgentProvider.mockReset();
    dependencies.getAgentProvider.mockReturnValue({});
    dependencies.getRun.mockReset();
    dependencies.getRun.mockResolvedValue({
      id: "run-1",
      mode: "team",
      status: "awaiting_approval",
      planJson,
    });
  });

  afterEach(() => {
    dependencies.gate.reset();
  });

  it("releases the team gate when claiming an approval throws", async () => {
    dependencies.claimRunForApproval.mockRejectedValue(new Error("database unavailable"));

    const response = await POST(
      new Request("http://localhost/api/projects/project-1/runs/run-1/approve", {
        method: "POST",
        headers: { "x-project-token": "owner-token-1" },
      }),
      { params: Promise.resolve({ projectId: "project-1", runId: "run-1" }) },
    );

    expect(response.status).toBe(503);
    await expect(response.json()).resolves.toEqual({ error: "暂时无法开始构建，请稍后重试。" });
    expect(dependencies.getAgentProvider).toHaveBeenCalledWith(process.env);
    expect(dependencies.gate.isBusy()).toBe(false);

    const release = await dependencies.gate.acquire();
    release();
    expect(dependencies.gate.isBusy()).toBe(false);
  });
});
