import { ConcurrencyGate } from "@/lib/concurrency";
import { createRateLimiter } from "@/lib/rate-limit";

const windowMs = 10 * 60 * 1000;
const modelStartRateLimiter = createRateLimiter(5, windowMs);
const projectCreationRateLimiter = createRateLimiter(5, windowMs);

export const teamGenerationGate = new ConcurrencyGate(1);
export const specialistGenerationGate = new ConcurrencyGate(2);

export function clientIpFromRequest(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return forwarded || request.headers.get("x-real-ip")?.trim() || "unknown";
}

export function allowModelStart(request: Request): boolean {
  return modelStartRateLimiter.allow(clientIpFromRequest(request), Date.now());
}

export function allowProjectCreation(request: Request): boolean {
  return projectCreationRateLimiter.allow(clientIpFromRequest(request), Date.now());
}

export function resetExecutionLimitsForTests(): void {
  modelStartRateLimiter.reset();
  projectCreationRateLimiter.reset();
}
