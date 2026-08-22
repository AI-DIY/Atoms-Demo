import { describe, expect, it, vi } from "vitest";
import { createOpenAIProvider, type ResponsesClient } from "@/lib/providers/openai";
import { getRole } from "@/lib/roles";

const context = {
  goal: "为摄影师创建预约工具",
  request: "整理用户和流程",
  artifacts: [],
};

function clientReturning(outputText: string): ResponsesClient {
  return {
    responses: {
      create: vi.fn().mockResolvedValue({ output_text: outputText }),
    },
  };
}

describe("createOpenAIProvider", () => {
  it("rejects incomplete model configuration before creating a client", () => {
    const createClient = vi.fn();

    expect(() => createOpenAIProvider(
      { baseUrl: "", apiKey: "secret", model: "gpt-5.5" },
      { createClient },
    )).toThrow("Model configuration is incomplete");
    expect(createClient).not.toHaveBeenCalled();
  });

  it("uses the role instruction, restricted context, model and structured output", async () => {
    const client = clientReturning(JSON.stringify({
      summary: "已整理产品范围。",
      artifact: {
        type: "prd",
        content: {
          users: ["摄影师"],
          scope: ["预约管理"],
          flow: ["选择时段"],
          acceptance: ["可以选择时段"],
        },
      },
    }));
    const createClient = vi.fn().mockReturnValue(client);
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { createClient },
    );

    const output = await provider.generate("pm", context);

    expect(createClient).toHaveBeenCalledWith({
      baseURL: "https://models.example/v1",
      apiKey: "secret",
    });
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5.5",
      instructions: expect.stringContaining(getRole("pm").systemInstruction),
      input: JSON.stringify(context),
      text: { format: { type: "json_object" } },
    }));
    expect(output).toMatchObject({
      summary: "已整理产品范围。",
      artifact: { type: "prd", content: { users: ["摄影师"] } },
    });
  });

  it("retries once without structured output only when the endpoint rejects that parameter", async () => {
    const client: ResponsesClient = {
      responses: {
        create: vi.fn()
          .mockRejectedValueOnce(Object.assign(new Error("Unknown parameter: text.format"), { status: 400 }))
          .mockResolvedValueOnce({ output_text: JSON.stringify({
            summary: "已完成研究。",
            artifact: {
              type: "research",
              content: { findings: ["需求清晰"], assumptions: ["用户使用移动端"] },
            },
          }) }),
      },
    };
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).resolves.toMatchObject({
      artifact: { type: "research" },
    });
    expect(client.responses.create).toHaveBeenCalledTimes(2);
    expect(client.responses.create).toHaveBeenLastCalledWith(expect.objectContaining({
      instructions: expect.stringContaining("只输出一个 JSON 对象"),
    }));
    expect(client.responses.create).toHaveBeenLastCalledWith(expect.not.objectContaining({ text: expect.anything() }));
  });

  it("does not retry an ordinary API failure or expose the API key", async () => {
    const client: ResponsesClient = {
      responses: {
        create: vi.fn().mockRejectedValue(new Error("request failed with secret")),
      },
    };
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).rejects.toThrow("[REDACTED]");
    expect(client.responses.create).toHaveBeenCalledTimes(1);
  });

  it("rejects an output with an unexpected artifact type", async () => {
    const client = clientReturning(JSON.stringify({
      summary: "错误产物",
      artifact: { type: "app", content: { title: "x", html: "<p>too short</p>" } },
    }));
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).rejects.toThrow("Unexpected artifact type");
  });

  it("rejects an invalid artifact even when its type matches the requested role", async () => {
    const client = clientReturning(JSON.stringify({
      summary: "错误产物",
      artifact: { type: "research", content: { findings: [], assumptions: [] } },
    }));
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).rejects.toThrow("Invalid research artifact");
  });
});
