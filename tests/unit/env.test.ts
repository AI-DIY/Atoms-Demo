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

  it("does not read OpenAI model settings from the environment", () => {
    const provider = {} as AgentProvider;
    const createProvider = vi.fn().mockReturnValue(provider);

    expect(() => getAgentProvider({
      MOCK_LLM: "false",
      OPENAI_BASE_URL: "https://models.example/v1",
      OPENAI_API_KEY: "server-only-secret",
      OPENAI_MODEL: "gpt-5.5",
    }, createProvider)).toThrow("Model configuration is incomplete");
    expect(createProvider).not.toHaveBeenCalled();
  });
});
