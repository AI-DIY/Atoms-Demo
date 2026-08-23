import { describe, expect, it } from "vitest";
import { maskApiKey, modelConfigInput } from "@/lib/model-config";

describe("model config", () => {
  it("accepts the configured runtime metadata", () => {
    expect(modelConfigInput.parse({
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-secret",
      modelId: "gpt-5.5",
      displayName: "主模型",
      notes: "用于工作区生成",
      maxOutputTokens: 2048,
      reasoningEffort: "high",
    })).toMatchObject({ modelId: "gpt-5.5", maxOutputTokens: 2048 });
  });

  it("masks API keys in user-facing data", () => {
    expect(maskApiKey("sk-1234567890")).toBe("sk-1••••7890");
  });
});
