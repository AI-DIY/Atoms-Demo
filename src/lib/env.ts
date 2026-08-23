import type { AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";
import { createOpenAIProvider } from "@/lib/providers/openai";
import type { OpenAIProviderConfig } from "@/lib/providers/openai";

type ModelEnvironment = Record<string, string | undefined>;

export function getAgentProvider(
  environment: ModelEnvironment = process.env,
  createProvider: typeof createOpenAIProvider = createOpenAIProvider,
  userConfig?: OpenAIProviderConfig,
): AgentProvider {
  if (userConfig) {
    return createProvider(userConfig);
  }

  if (environment.MOCK_LLM === "true") {
    return new MockProvider();
  }

  throw new Error("Model configuration is incomplete");
}
