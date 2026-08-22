import { describe, expect, it } from "vitest";
import type { AgentContext } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";

const context: AgentContext = {
  goal: "为摄影师创建预约与报价工具",
  request: "请生成可执行产物",
  artifacts: [],
};

describe("MockProvider", () => {
  it("creates a constrained default team plan without an API key", async () => {
    const output = await new MockProvider().generate("leader", context);

    expect(output.artifact.type).toBe("plan");
    expect(output.artifact.content).toMatchObject({
      roles: ["pm", "architect", "engineer"],
    });
    expect((output.artifact.content as { risks: unknown[] }).risks).toHaveLength(
      3,
    );
  });

  it("returns the product and architecture artifacts required by the team flow", async () => {
    const provider = new MockProvider();
    const product = await provider.generate("pm", context);
    const architecture = await provider.generate("architect", context);

    expect(product.artifact).toMatchObject({
      type: "prd",
      content: {
        users: expect.any(Array),
        scope: expect.any(Array),
        flow: expect.any(Array),
        acceptance: expect.any(Array),
      },
    });
    expect(architecture.artifact).toMatchObject({
      type: "architecture",
      content: {
        pages: expect.any(Array),
        state: expect.any(Array),
        constraints: expect.any(Array),
      },
    });
  });

  it("builds a self-contained booking app that can add and delete appointments", async () => {
    const output = await new MockProvider().generate("engineer", context);
    const html = (output.artifact.content as { html: string }).html;

    expect(output.artifact.type).toBe("app");
    expect(html).toContain("<!doctype html>");
    expect(html).toContain("addEventListener");
    expect(html).toContain("删除预约");
  });

  it("returns each specialist's own artifact type", async () => {
    const provider = new MockProvider();

    await expect(provider.generate("research", context)).resolves.toMatchObject({
      artifact: { type: "research" },
    });
    await expect(provider.generate("data", context)).resolves.toMatchObject({
      artifact: { type: "analysis" },
    });
    await expect(provider.generate("seo", context)).resolves.toMatchObject({
      artifact: { type: "seo" },
    });
    await expect(provider.generate("growth", context)).resolves.toMatchObject({
      artifact: { type: "growth" },
    });
  });
});
