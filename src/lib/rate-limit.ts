export type RateLimiter = {
  allow: (key: string, now: number) => boolean;
  reset: () => void;
};

export function createRateLimiter(limit: number, windowMs: number): RateLimiter {
  if (!Number.isInteger(limit) || limit < 1 || !Number.isFinite(windowMs) || windowMs <= 0) {
    throw new Error("Rate limit configuration is invalid");
  }

  const attemptsByKey = new Map<string, number[]>();

  return {
    allow(key, now) {
      const earliestAllowed = now - windowMs;
      const activeAttempts = (attemptsByKey.get(key) ?? []).filter(
        (attempt) => attempt > earliestAllowed,
      );

      if (activeAttempts.length >= limit) {
        attemptsByKey.set(key, activeAttempts);
        return false;
      }

      activeAttempts.push(now);
      attemptsByKey.set(key, activeAttempts);
      return true;
    },
    reset() {
      attemptsByKey.clear();
    },
  };
}
