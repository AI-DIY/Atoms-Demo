import type { AgentProvider } from "@/lib/provider";
import { MockProvider } from "@/lib/providers/mock";
import { createOpenAIProvider } from "@/lib/providers/openai";
import { z } from "zod";

type ModelEnvironment = Record<string, string | undefined>;

const hostResponsesConfig = z.object({
  RESPONSES_API_BASE_URL: z.string().trim().url().refine(
    (value) => /^https?:\/\//iu.test(value),
  ),
  RESPONSES_API_KEY: z.string().trim().min(1),
  RESPONSES_MODEL: z.string().trim().min(1),
  RESPONSES_MAX_OUTPUT_TOKENS: z.string().trim().regex(/^\d+$/u).transform(Number)
    .pipe(z.number().int().min(256).max(32_768)).optional(),
  RESPONSES_REASONING_EFFORT: z.enum(["none", "low", "medium", "high"]).optional(),
});

export function getAgentProvider(
  environment: ModelEnvironment = process.env,
  createProvider: typeof createOpenAIProvider = createOpenAIProvider,
): AgentProvider {
  if (environment.MOCK_LLM === "true") {
    return new MockProvider();
  }

  const parsed = hostResponsesConfig.safeParse(environment);

  if (!parsed.success) {
    throw new Error("Host Responses API configuration is incomplete");
  }

  return createProvider({
    baseUrl: parsed.data.RESPONSES_API_BASE_URL,
    apiKey: parsed.data.RESPONSES_API_KEY,
    model: parsed.data.RESPONSES_MODEL,
    maxOutputTokens: parsed.data.RESPONSES_MAX_OUTPUT_TOKENS,
    reasoningEffort: parsed.data.RESPONSES_REASONING_EFFORT,
  });
}
