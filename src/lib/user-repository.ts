import type { ModelConfig, User } from "@prisma/client";
import { prisma } from "@/server/prisma";

export type UserWithConfig = User & { modelConfig: ModelConfig | null };

export function findUserByEmail(email: string) {
  return prisma.user.findUnique({ where: { email } });
}

export function createUser(input: { email: string; passwordHash: string }) {
  return prisma.user.create({
    data: {
      email: input.email,
      passwordHash: input.passwordHash,
    },
  });
}

export function findUserById(id: string): Promise<UserWithConfig | null> {
  return prisma.user.findUnique({
    where: { id },
    include: { modelConfig: true },
  });
}

export function getModelConfig(userId: string) {
  return prisma.modelConfig.findUnique({ where: { userId } });
}

export function createModelConfig(input: {
  userId: string;
  baseUrl: string;
  apiKeyCiphertext: string;
  modelId: string;
  displayName: string;
  notes?: string;
  maxOutputTokens?: number;
  reasoningEffort?: string;
}) {
  return prisma.modelConfig.create({
    data: {
      userId: input.userId,
      baseUrl: input.baseUrl,
      apiKeyCiphertext: input.apiKeyCiphertext,
      modelId: input.modelId,
      displayName: input.displayName,
      notes: input.notes,
      maxOutputTokens: input.maxOutputTokens,
      reasoningEffort: input.reasoningEffort,
    },
  });
}

export function upsertModelConfig(input: {
  userId: string;
  baseUrl: string;
  apiKeyCiphertext: string;
  modelId: string;
  displayName: string;
  notes?: string;
  maxOutputTokens?: number;
  reasoningEffort?: string;
}) {
  const data = {
    baseUrl: input.baseUrl,
    apiKeyCiphertext: input.apiKeyCiphertext,
    modelId: input.modelId,
    displayName: input.displayName,
    notes: input.notes,
    maxOutputTokens: input.maxOutputTokens,
    reasoningEffort: input.reasoningEffort,
  };

  return prisma.modelConfig.upsert({
    where: { userId: input.userId },
    create: { userId: input.userId, ...data },
    update: data,
  });
}

export function markOnboardingCompleted(userId: string) {
  return prisma.user.update({
    where: { id: userId },
    data: { onboardingCompleted: true },
  });
}
