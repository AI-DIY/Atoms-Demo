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

  it("uses the role instruction, restricted context, model and strict JSON Schema output", async () => {
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

    expect(createClient).toHaveBeenCalledWith(expect.objectContaining({
      baseURL: "https://models.example/v1",
      apiKey: "secret",
      fetch: expect.any(Function),
    }));
    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({
      model: "gpt-5.5",
      instructions: expect.stringContaining(getRole("pm").systemInstruction),
      input: JSON.stringify(context),
      text: {
        format: expect.objectContaining({
          type: "json_schema",
          name: "agent_output",
          strict: true,
        }),
      },
    }));
    expect(output).toMatchObject({
      summary: "已整理产品范围。",
      artifact: { type: "prd", content: { users: ["摄影师"] } },
    });
  });

  it("delegates compatible Responses requests to the Node native fetch implementation", async () => {
    const nativeFetch = vi.fn().mockResolvedValue(new Response("{}", { status: 200 }));
    vi.stubGlobal("fetch", nativeFetch);
    const client = clientReturning(JSON.stringify({
      summary: "已完成研究。",
      artifact: {
        type: "research",
        content: { findings: ["需求清晰"], assumptions: ["用户使用移动端"] },
      },
    }));
    const createClient = vi.fn().mockReturnValue(client);
    createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { createClient },
    );

    try {
      const clientOptions = createClient.mock.calls[0]?.[0];
      expect(clientOptions?.fetch).toEqual(expect.any(Function));

      await clientOptions?.fetch?.("https://models.example/v1/responses", { method: "POST" });

      expect(nativeFetch).toHaveBeenCalledWith(
        "https://models.example/v1/responses",
        { method: "POST" },
      );
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("passes optional output and reasoning settings to Responses", async () => {
    const client = clientReturning(JSON.stringify({
      summary: "已完成研究。",
      artifact: {
        type: "research",
        content: { findings: ["需求清晰"], assumptions: ["用户使用移动端"] },
      },
    }));
    const provider = createOpenAIProvider({
      baseUrl: "https://models.example/v1",
      apiKey: "secret",
      model: "gpt-5.5",
      maxOutputTokens: 1200,
      reasoningEffort: "medium",
    }, { client });

    await provider.generate("research", context);

    expect(client.responses.create).toHaveBeenCalledWith(expect.objectContaining({
      max_output_tokens: 1200,
      reasoning: { effort: "medium" },
    }));
  });

  it("uses strict schemas for the leader plan and engineer app artifacts", async () => {
    const client: ResponsesClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce({ output_text: JSON.stringify({
            summary: "已完成计划。",
            artifact: {
              type: "plan",
              content: { roles: ["pm", "architect", "engineer"], risks: ["需要确认流程"] },
            },
          }) })
          .mockResolvedValueOnce({ output_text: JSON.stringify({
            summary: "已完成页面。",
            artifact: {
              type: "app",
              content: {
                title: "预约工具",
                html: `<!doctype html><html><body>${"x".repeat(100)}</body></html>`,
              },
            },
          }) }),
      },
    };
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await provider.generate("leader", context);
    await provider.generate("engineer", context);

    const leaderFormat = vi.mocked(client.responses.create).mock.calls[0]?.[0].text?.format;
    const engineerFormat = vi.mocked(client.responses.create).mock.calls[1]?.[0].text?.format;
    expect(leaderFormat).toMatchObject({
      type: "json_schema",
      name: "agent_output",
      strict: true,
      schema: {
        additionalProperties: false,
        required: ["summary", "artifact", "suggestedNextAction"],
        properties: {
          suggestedNextAction: { type: ["string", "null"] },
          artifact: {
            properties: {
              type: { enum: ["plan"] },
              content: { additionalProperties: false, required: ["roles", "risks"] },
            },
          },
        },
      },
    });
    expect(engineerFormat).toMatchObject({
      type: "json_schema",
      name: "agent_output",
      strict: true,
      schema: {
        properties: {
          artifact: {
            properties: {
              type: { enum: ["app"] },
              content: { additionalProperties: false, required: ["title", "html"] },
            },
          },
        },
      },
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
        create: vi.fn().mockRejectedValue(Object.assign(
          new Error("request failed with secret"),
          { status: 429 },
        )),
      },
    };
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).rejects.toThrow("[REDACTED]");
    expect(client.responses.create).toHaveBeenCalledTimes(1);
  });

  it("repairs an invalid structured response exactly once with the same schema", async () => {
    const client: ResponsesClient = {
      responses: {
        create: vi.fn()
          .mockResolvedValueOnce({ output_text: "not valid JSON" })
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
      instructions: expect.stringContaining("完整 JSON"),
      text: { format: expect.objectContaining({ type: "json_schema", strict: true }) },
    }));
    expect(JSON.parse(vi.mocked(client.responses.create).mock.calls[1]?.[0].input ?? "{}")).toMatchObject({
      invalidOutput: "not valid JSON",
    });
  });

  it("repairs invalid JSON from the unstructured compatibility fallback without another structured parameter", async () => {
    const client: ResponsesClient = {
      responses: {
        create: vi.fn()
          .mockRejectedValueOnce(Object.assign(new Error("Unknown parameter: text.format"), { status: 400 }))
          .mockResolvedValueOnce({ output_text: "not valid JSON" })
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
    expect(client.responses.create).toHaveBeenCalledTimes(3);
    expect(client.responses.create).toHaveBeenLastCalledWith(expect.objectContaining({
      instructions: expect.stringContaining("完整 JSON"),
    }));
    expect(client.responses.create).toHaveBeenLastCalledWith(expect.not.objectContaining({ text: expect.anything() }));
  });

  it("returns a safe error when a repaired output remains invalid", async () => {
    const client = clientReturning(JSON.stringify({
      summary: "错误产物",
      artifact: { type: "app", content: { title: "x", html: "<p>too short</p>" } },
    }));
    const provider = createOpenAIProvider(
      { baseUrl: "https://models.example/v1", apiKey: "secret", model: "gpt-5.5" },
      { client },
    );

    await expect(provider.generate("research", context)).rejects.toThrow("Model response is invalid after repair");
    expect(client.responses.create).toHaveBeenCalledTimes(2);
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

    await expect(provider.generate("research", context)).rejects.toThrow("Model response is invalid after repair");
    expect(client.responses.create).toHaveBeenCalledTimes(2);
  });
});
