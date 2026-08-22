import type { AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";

type ModelEnvironment = Record<string, string | undefined>;

export function getAgentProvider(environment: ModelEnvironment = process.env): AgentProvider {
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

  throw new Error("Real model provider is not available");
}
