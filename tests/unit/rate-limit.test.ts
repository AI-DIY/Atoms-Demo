import { describe, expect, it } from "vitest";
import { createRateLimiter } from "@/lib/rate-limit";

describe("createRateLimiter", () => {
  it("rejects the sixth request in a five-request window", () => {
    const limiter = createRateLimiter(5, 60_000);

    for (let index = 0; index < 5; index += 1) {
      expect(limiter.allow("192.0.2.1", index)).toBe(true);
    }

    expect(limiter.allow("192.0.2.1", 5)).toBe(false);
  });

  it("allows requests again after the rolling window expires", () => {
    const limiter = createRateLimiter(1, 60_000);

    expect(limiter.allow("192.0.2.1", 0)).toBe(true);
    expect(limiter.allow("192.0.2.1", 60_000)).toBe(true);
  });

  it("tracks keys independently", () => {
    const limiter = createRateLimiter(1, 60_000);

    expect(limiter.allow("192.0.2.1", 0)).toBe(true);
    expect(limiter.allow("192.0.2.2", 0)).toBe(true);
    expect(limiter.allow("192.0.2.1", 1)).toBe(false);
  });

  it("bounds stored keys and prunes expired keys before accepting a fresh key", () => {
    const limiter = createRateLimiter(2, 60_000, 3);

    expect(limiter.allow("192.0.2.10", 0)).toBe(true);
    expect(limiter.allow("192.0.2.11", 0)).toBe(true);
    expect(limiter.allow("192.0.2.12", 0)).toBe(true);
    expect(limiter.allow("192.0.2.13", 0)).toBe(false);
    expect(limiter.size()).toBe(3);

    expect(limiter.allow("192.0.2.20", 60_001)).toBe(true);
    expect(limiter.size()).toBe(1);
    expect(limiter.allow("192.0.2.20", 60_001)).toBe(true);
    expect(limiter.allow("192.0.2.20", 60_001)).toBe(false);
  });

  it("denies a cold key at capacity without resetting an active key window", () => {
    const limiter = createRateLimiter(1, 60_000, 1);

    expect(limiter.allow("victim", 0)).toBe(true);
    expect(limiter.allow("cold", 1)).toBe(false);
    expect(limiter.allow("victim", 2)).toBe(false);
    expect(limiter.allow("cold", 60_000)).toBe(true);
    expect(limiter.size()).toBe(1);
  });
});
