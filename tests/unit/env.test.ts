import { describe, expect, it, vi } from "vitest";
import { getAgentProvider } from "@/lib/env";
import { MockProvider } from "@/lib/providers/mock";
import type { AgentProvider } from "@/lib/provider";

describe("getAgentProvider", () => {
  it("uses MockProvider only when MOCK_LLM is exactly true", () => {
    expect(getAgentProvider({ MOCK_LLM: "true" })).toBeInstanceOf(MockProvider);
  });

  it("rejects any non-mock environment with incomplete model configuration", () => {
    expect(() => getAgentProvider({ MOCK_LLM: "TRUE" })).toThrow(
      "Model configuration is incomplete",
    );
  });

  it("creates the real provider only when all server-side model settings are present", () => {
    const provider = {} as AgentProvider;
    const createProvider = vi.fn().mockReturnValue(provider);

    expect(getAgentProvider({
      MOCK_LLM: "false",
      OPENAI_BASE_URL: "https://models.example/v1",
      OPENAI_API_KEY: "server-only-secret",
      OPENAI_MODEL: "gpt-5.5",
    }, createProvider)).toBe(provider);
    expect(createProvider).toHaveBeenCalledWith({
      baseUrl: "https://models.example/v1",
      apiKey: "server-only-secret",
      model: "gpt-5.5",
    });
  });
});
