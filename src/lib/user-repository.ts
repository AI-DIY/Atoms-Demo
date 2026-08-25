import type { User } from "@prisma/client";
import { prisma } from "@/server/prisma";

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

export function findUserById(id: string): Promise<User | null> {
  return prisma.user.findUnique({ where: { id } });
}
