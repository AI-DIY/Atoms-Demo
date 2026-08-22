export type RateLimiter = {
  allow: (key: string, now: number) => boolean;
  reset: () => void;
  size: () => number;
};

export function createRateLimiter(
  limit: number,
  windowMs: number,
  maxKeys = 10_000,
): RateLimiter {
  if (
    !Number.isInteger(limit)
    || limit < 1
    || !Number.isFinite(windowMs)
    || windowMs <= 0
    || !Number.isInteger(maxKeys)
    || maxKeys < 1
  ) {
    throw new Error("Rate limit configuration is invalid");
  }

  const attemptsByKey = new Map<string, number[]>();

  function activeAttempts(attempts: number[], now: number) {
    const earliestAllowed = now - windowMs;
    return attempts.filter((attempt) => attempt > earliestAllowed);
  }

  function makeRoom(now: number): boolean {
    if (attemptsByKey.size < maxKeys) {
      return true;
    }

    for (const [key, attempts] of attemptsByKey) {
      const active = activeAttempts(attempts, now);

      if (active.length === 0) {
        attemptsByKey.delete(key);
      } else if (active.length !== attempts.length) {
        attemptsByKey.set(key, active);
      }
    }

    return attemptsByKey.size < maxKeys;
  }

  return {
    allow(key, now) {
      const active = activeAttempts(attemptsByKey.get(key) ?? [], now);

      if (active.length === 0) {
        attemptsByKey.delete(key);
      }

      if (active.length >= limit) {
        attemptsByKey.delete(key);
        attemptsByKey.set(key, active);
        return false;
      }

      if (!attemptsByKey.has(key) && !makeRoom(now)) {
        return false;
      }

      active.push(now);
      attemptsByKey.delete(key);
      attemptsByKey.set(key, active);
      return true;
    },
    reset() {
      attemptsByKey.clear();
    },
    size() {
      return attemptsByKey.size;
    },
  };
}
