import type { AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";
import { createOpenAIProvider } from "@/lib/providers/openai";

type ModelEnvironment = Record<string, string | undefined>;

export function getAgentProvider(
  environment: ModelEnvironment = process.env,
  createProvider: typeof createOpenAIProvider = createOpenAIProvider,
): AgentProvider {
  if (environment.MOCK_LLM === "true") {
    return new MockProvider();
  }

  if (
    !environment.OPENAI_BASE_URL ||
    !environment.OPENAI_API_KEY ||
    !environment.OPENAI_MODEL
  ) {
    throw new Error("Model configuration is incomplete");
  }

  return createProvider({
    baseUrl: environment.OPENAI_BASE_URL,
    apiKey: environment.OPENAI_API_KEY,
    model: environment.OPENAI_MODEL,
  });
}
