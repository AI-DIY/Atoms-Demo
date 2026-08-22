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
});
