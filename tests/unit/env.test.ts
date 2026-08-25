import { describe, expect, it, vi } from "vitest";
import { getAgentProvider } from "@/lib/env";
import { MockProvider } from "@/lib/providers/mock";
import type { AgentProvider } from "@/lib/provider";

describe("getAgentProvider", () => {
  it("uses MockProvider only when MOCK_LLM is exactly true", () => {
    expect(getAgentProvider({ MOCK_LLM: "true" })).toBeInstanceOf(MockProvider);
  });

  it("rejects a non-mock host without a complete Responses API configuration", () => {
    expect(() => getAgentProvider({ MOCK_LLM: "false" })).toThrow(
      "Host Responses API configuration is incomplete",
    );
  });

  it("creates the provider from the unified host Responses API settings", () => {
    const provider = {} as AgentProvider;
    const createProvider = vi.fn().mockReturnValue(provider);

    expect(getAgentProvider({
      MOCK_LLM: "false",
      RESPONSES_API_BASE_URL: "https://models.example/v1",
      RESPONSES_API_KEY: "server-only-secret",
      RESPONSES_MODEL: "gpt-5.5",
      RESPONSES_MAX_OUTPUT_TOKENS: "4096",
      RESPONSES_REASONING_EFFORT: "medium",
    }, createProvider)).toBe(provider);
    expect(createProvider).toHaveBeenCalledWith({
      baseUrl: "https://models.example/v1",
      apiKey: "server-only-secret",
      model: "gpt-5.5",
      maxOutputTokens: 4096,
      reasoningEffort: "medium",
    });
  });
});
