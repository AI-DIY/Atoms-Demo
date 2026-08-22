import { z } from "zod";

export const maxProjectRequestBytes = 128 * 1024;

export const createProjectInput = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(8).max(2000),
});
