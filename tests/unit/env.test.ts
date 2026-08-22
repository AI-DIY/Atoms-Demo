import { describe, expect, it } from "vitest";
import { getAgentProvider } from "@/lib/env";
import { MockProvider } from "@/lib/providers/mock";

describe("getAgentProvider", () => {
  it("uses MockProvider only when MOCK_LLM is exactly true", () => {
    expect(getAgentProvider({ MOCK_LLM: "true" })).toBeInstanceOf(MockProvider);
  });

  it("rejects any non-mock environment with incomplete model configuration", () => {
    expect(() => getAgentProvider({ MOCK_LLM: "TRUE" })).toThrow(
      "Model configuration is incomplete",
    );
  });
});
