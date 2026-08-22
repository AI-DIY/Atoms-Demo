import { z } from "zod";

export const createProjectInput = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(8).max(2000),
});
