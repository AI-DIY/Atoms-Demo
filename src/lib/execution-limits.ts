import { ConcurrencyGate } from "@/lib/concurrency";
import { createRateLimiter } from "@/lib/rate-limit";

const windowMs = 10 * 60 * 1000;
const projectCreationRateLimiter = createRateLimiter(5, windowMs);

export const teamGenerationGate = new ConcurrencyGate(1);
export const specialistGenerationGate = new ConcurrencyGate(2);

export function clientIpFromRequest(request: Request): string {
  const realIp = request.headers.get("x-real-ip")?.trim();
  const forwarded = request.headers.get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  return realIp || forwarded || "unknown";
}

export function allowModelStart(_request: Request): boolean {
  return true;
}

export function allowProjectCreation(request: Request): boolean {
  return projectCreationRateLimiter.allow(clientIpFromRequest(request), Date.now());
}

export function resetExecutionLimitsForTests(): void {
  projectCreationRateLimiter.reset();
}
