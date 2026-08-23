import { z } from "zod";
import { decryptPersistedSecret, encryptPersistedSecret } from "@/lib/crypto";
import type { ModelConfig } from "@prisma/client";

export const modelConfigInput = z.object({
  baseUrl: z.string().trim().url().refine((value) => /^https?:\/\//iu.test(value), "Base URL 必须使用 HTTP 或 HTTPS"),
  apiKey: z.string().trim().max(500),
  modelId: z.string().trim().min(1).max(160),
  displayName: z.string().trim().min(1).max(160),
  notes: z.string().trim().max(1_000).optional().default(""),
  maxOutputTokens: z.number().int().min(256).max(32_768).optional(),
  reasoningEffort: z.enum(["none", "low", "medium", "high"]).optional(),
}).strict();

export type ModelConfigInput = z.infer<typeof modelConfigInput>;

export type ModelConfigView = Omit<ModelConfigInput, "apiKey"> & {
  apiKeyMasked: string;
};

export function maskApiKey(apiKey: string): string {
  if (apiKey.length <= 8) {
    return "••••••••";
  }

  return `${apiKey.slice(0, 4)}••••${apiKey.slice(-4)}`;
}

export async function modelConfigView(config: ModelConfig): Promise<ModelConfigView> {
  const apiKey = await decryptPersistedSecret(config.apiKeyCiphertext);

  return {
    baseUrl: config.baseUrl,
    modelId: config.modelId,
    displayName: config.displayName,
    notes: config.notes ?? "",
    maxOutputTokens: config.maxOutputTokens ?? undefined,
    reasoningEffort: (config.reasoningEffort as ModelConfigView["reasoningEffort"]) ?? undefined,
    apiKeyMasked: maskApiKey(apiKey),
  };
}

export async function modelConfigForProvider(config: ModelConfig) {
  return {
    baseUrl: config.baseUrl,
    apiKey: await decryptPersistedSecret(config.apiKeyCiphertext),
    model: config.modelId,
    modelId: config.modelId,
    displayName: config.displayName,
    notes: config.notes ?? "",
    maxOutputTokens: config.maxOutputTokens ?? undefined,
    reasoningEffort: (config.reasoningEffort as "none" | "low" | "medium" | "high" | undefined) ?? undefined,
  };
}

export function encryptedApiKey(apiKey: string): Promise<string> {
  return encryptPersistedSecret(apiKey);
}
