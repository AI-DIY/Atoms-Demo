import { describe, expect, it } from "vitest";
import type { RoleId } from "@/lib/domain";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import {
  approvePlan,
  buildApprovedPlan,
  createTeamPlan,
} from "@/lib/orchestrator";
import { parseArtifact } from "@/lib/artifacts";

const validAppHtml = `<!doctype html>
<html lang="en"><head><title>Demo</title></head><body><main><h1>Booking tool</h1><button type="button">Create booking</button></main></body></html>`;

const roleOutputs: Partial<Record<RoleId, AgentOutput>> = {
  leader: {
    summary: "计划已就绪",
    artifact: {
      type: "plan",
      content: {
        roles: ["pm", "architect", "engineer"],
        risks: ["范围需要控制"],
      },
    },
  },
  pm: {
    summary: "需求已整理",
    artifact: {
      type: "prd",
      content: {
        users: ["摄影师"],
        scope: ["创建预约"],
        flow: ["填写并提交预约"],
        acceptance: ["可创建一条预约"],
      },
    },
  },
  architect: {
    summary: "架构已完成",
    artifact: {
      type: "architecture",
      content: {
        pages: ["预约页"],
        state: ["预约列表"],
        constraints: ["单文件应用"],
      },
    },
  },
  engineer: {
    summary: "应用已生成",
    artifact: {
      type: "app",
      content: {
        title: "预约工具",
        html: validAppHtml,
      },
    },
  },
};

class RecordingProvider implements AgentProvider {
  readonly calls: Array<{ role: string; context: AgentContext }> = [];

  async generate(role: RoleId, context: AgentContext): Promise<AgentOutput> {
    this.calls.push({ role, context });
    const output = roleOutputs[role];

    if (!output) {
      throw new Error(`Unexpected role: ${role}`);
    }

    return output;
  }
}

describe("team orchestration", () => {
  it("creates an unapproved plan from exactly one leader call", async () => {
    const provider = new RecordingProvider();

    const plan = await createTeamPlan(provider, "Build a photography booking tool");

    expect(provider.calls.map((call) => call.role)).toEqual(["leader"]);
    expect(plan).toMatchObject({
      approved: false,
      artifact: {
        type: "plan",
        content: { roles: ["pm", "architect", "engineer"] },
      },
      steps: [{ role: "leader", status: "completed" }],
    });
  });

  it("does not call an engineer until a team plan is approved", async () => {
    const provider = new RecordingProvider();
    const plan = await createTeamPlan(provider, "Build a photography booking tool");

    await expect(buildApprovedPlan(provider, plan)).rejects.toThrow("approved");

    expect(provider.calls.map((call) => call.role)).toEqual(["leader"]);
    expect(approvePlan(plan)).not.toBe(plan);
    expect(approvePlan(plan)).toMatchObject({ approved: true });
  });

  it("runs PM, architect, and engineer in order with validated upstream artifacts", async () => {
    const provider = new RecordingProvider();
    const plan = await createTeamPlan(provider, "Build a photography booking tool");

    const result = await buildApprovedPlan(provider, approvePlan(plan));

    expect(provider.calls.map((call) => call.role)).toEqual([
      "leader",
      "pm",
      "architect",
      "engineer",
    ]);
    expect(provider.calls[1].context.artifacts.map((artifact) => artifact.type)).toEqual([
      "plan",
    ]);
    expect(provider.calls[2].context.artifacts.map((artifact) => artifact.type)).toEqual([
      "plan",
      "prd",
    ]);
    expect(provider.calls[3].context.artifacts.map((artifact) => artifact.type)).toEqual([
      "plan",
      "prd",
      "architecture",
    ]);
    expect(result.steps.map((step) => step.role)).toEqual([
      "leader",
      "pm",
      "architect",
      "engineer",
      "reviewer",
    ]);
    expect(result.steps.at(-1)).toMatchObject({
      role: "reviewer",
      status: "completed",
      artifact: { type: "app", content: { title: "预约工具" } },
    });
  });

  it("rejects invalid model output before a reviewer step can be created", async () => {
    const provider = new RecordingProvider();
    const invalidAppProvider: AgentProvider = {
      async generate(role, context) {
        if (role === "engineer") {
          return {
            summary: "无效应用",
            artifact: {
              type: "app",
              content: { title: "", html: "too short" },
            },
          };
        }

        return provider.generate(role, context);
      },
    };
    const plan = await createTeamPlan(invalidAppProvider, "Build a photography booking tool");

    await expect(
      buildApprovedPlan(invalidAppProvider, approvePlan(plan)),
    ).rejects.toThrow("Invalid app artifact");
    expect(provider.calls.map((call) => call.role)).toEqual([
      "leader",
      "pm",
      "architect",
    ]);
  });
});

describe("parseArtifact", () => {
  it("requires the fixed team roles and no more than three risks", () => {
    expect(() =>
      parseArtifact("plan", {
        roles: ["architect", "pm", "engineer"],
        risks: [],
      }),
    ).toThrow("Invalid plan artifact");
    expect(() =>
      parseArtifact("plan", {
        roles: ["pm", "architect", "engineer"],
        risks: ["one", "two", "three", "four"],
      }),
    ).toThrow("Invalid plan artifact");
  });

  it("sanitizes a valid app and rejects app values outside its schema", () => {
    const app = parseArtifact("app", {
      title: "  Demo  ",
      html: `${validAppHtml}<script src="https://bad.test/app.js"></script>`,
    });

    expect(app.content).toMatchObject({ title: "Demo" });
    expect((app.content as { html: string }).html).not.toContain("https://bad.test");
    expect(() =>
      parseArtifact("app", { title: "", html: "too short" }),
    ).toThrow("Invalid app artifact");
  });
});
