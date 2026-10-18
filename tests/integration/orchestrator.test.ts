import { describe, expect, it } from "vitest";
import type { RoleId } from "@/lib/domain";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import {
  approvePlan,
  buildApprovedPlan,
  createTeamPlan,
} from "@/lib/orchestrator";
import * as orchestrator from "@/lib/orchestrator";
import { parseArtifact } from "@/lib/artifacts";
import { MockProvider } from "@/lib/providers/mock";

const validAppHtml = `<!doctype html>
<html lang="en"><head><title>Demo</title></head><body><main><h1>Booking tool</h1><button type="button" data-acceptance="可创建一条预约">Create booking</button></main></body></html>`;

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
  research: {
    summary: "已整理目标用户和风险假设。",
    artifact: {
      type: "research",
      content: {
        findings: ["用户需要更快完成预约确认"],
        assumptions: ["用户愿意在线提交预约信息"],
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

  it("fails after one repair when an app still omits a PM acceptance marker", async () => {
    const provider = new RecordingProvider();
    let engineerCalls = 0;
    const missingCoverageProvider: AgentProvider = {
      async generate(role, context) {
        if (role === "engineer") {
          engineerCalls += 1;
          return {
            summary: "未覆盖验收条件的应用",
            artifact: {
              type: "app",
              content: {
                title: "预约工具",
                html: validAppHtml.replace(
                  ' data-acceptance="可创建一条预约"',
                  "",
                ),
              },
            },
          };
        }

        return provider.generate(role, context);
      },
    };
    const plan = await createTeamPlan(
      missingCoverageProvider,
      "Build a photography booking tool",
    );

    await expect(
      buildApprovedPlan(missingCoverageProvider, approvePlan(plan)),
    ).rejects.toThrow("acceptance coverage");
    expect(engineerCalls).toBe(2);
    expect(provider.calls.map((call) => call.role)).toEqual([
      "leader",
      "pm",
      "architect",
    ]);
  });

  it("repairs a dynamic-only acceptance marker once with the prior app and review feedback", async () => {
    const provider = new RecordingProvider();
    const engineerContexts: AgentContext[] = [];
    const dynamicHtml = validAppHtml.replace(' data-acceptance="可创建一条预约"', "")
      .replace("</body>", "<script>document.querySelector('button').dataset.acceptance='可创建一条预约';</script></body>");
    const repairProvider: AgentProvider = {
      async generate(role, context) {
        if (role === "engineer") {
          engineerContexts.push(context);
          return {
            summary: "应用实现",
            artifact: { type: "app", content: { title: "预约工具", html: engineerContexts.length === 1 ? dynamicHtml : validAppHtml } },
          };
        }
        return provider.generate(role, context);
      },
    };
    const plan = await createTeamPlan(repairProvider, "创建预约工具");
    const result = await buildApprovedPlan(repairProvider, approvePlan(plan));
    expect(engineerContexts).toHaveLength(2);
    expect(engineerContexts[1].request).toContain("可创建一条预约");
    expect(engineerContexts[1].artifacts.at(-1)).toMatchObject({ type: "app", content: { html: dynamicHtml } });
    expect(result.app.content.html).toBe(validAppHtml);
    expect(result.steps.map((step) => step.role)).toEqual(["leader", "pm", "architect", "engineer", "engineer", "reviewer"]);
  });

  it.each([
    "为摄影师创建预约与报价工具",
    "为内容团队创建内容日历",
    "为销售团队创建客户线索看板",
  ])("completes deterministic acceptance review for the standard MockProvider: %s", async (goal) => {
    const provider = new MockProvider();
    const plan = await createTeamPlan(provider, goal);

    const result = await buildApprovedPlan(provider, approvePlan(plan));

    expect(result.steps.at(-1)).toMatchObject({
      role: "reviewer",
      status: "completed",
    });
  });
});

describe("specialist and iteration orchestration", () => {
  it("calls only the mentioned specialist and preserves its own artifact", async () => {
    const runMention = Reflect.get(orchestrator, "runMention") as
      | ((
          provider: AgentProvider,
          role: RoleId,
          goal: string,
          request: string,
        ) => Promise<{ role: RoleId; artifact: { type: string } }>)
      | undefined;

    expect(runMention).toBeTypeOf("function");
    if (!runMention) {
      return;
    }

    const provider = new RecordingProvider();
    const result = await runMention(
      provider,
      "research",
      "创建摄影预约工具",
      "@研究员 请分析目标用户",
    );

    expect(provider.calls.map((call) => call.role)).toEqual(["research"]);
    expect(result).toMatchObject({ role: "research", artifact: { type: "research" } });
  });

  it("calls only Engineer for an iteration and supplies the current app artifact", async () => {
    const runIteration = Reflect.get(orchestrator, "runIteration") as
      | ((
          provider: AgentProvider,
          goal: string,
          request: string,
          app: ReturnType<typeof parseArtifact>,
        ) => Promise<{ role: string; artifact: { type: string } }>)
      | undefined;

    expect(runIteration).toBeTypeOf("function");
    if (!runIteration) {
      return;
    }

    const provider = new RecordingProvider();
    const currentApp = parseArtifact("app", {
      title: "当前预约工具",
      html: validAppHtml,
    });
    const result = await runIteration(
      provider,
      "创建摄影预约工具",
      "将按钮文案改得更清晰",
      currentApp,
    );

    expect(provider.calls.map((call) => call.role)).toEqual(["engineer"]);
    expect(provider.calls[0]?.context.artifacts).toEqual([currentApp]);
    expect(result).toMatchObject({ role: "engineer", artifact: { type: "app" } });
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
