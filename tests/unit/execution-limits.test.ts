import { describe, expect, it } from "vitest";
import { clientIpFromRequest } from "@/lib/execution-limits";

describe("clientIpFromRequest", () => {
  it("uses the first forwarded address before the real IP fallback", () => {
    const request = new Request("http://localhost", {
      headers: {
        "x-forwarded-for": "198.51.100.8, 10.0.0.1",
        "x-real-ip": "198.51.100.9",
      },
    });

    expect(clientIpFromRequest(request)).toBe("198.51.100.8");
  });

  it("uses x-real-ip or unknown when forwarded headers are absent", () => {
    expect(clientIpFromRequest(new Request("http://localhost", {
      headers: { "x-real-ip": "198.51.100.9" },
    }))).toBe("198.51.100.9");
    expect(clientIpFromRequest(new Request("http://localhost"))).toBe("unknown");
  });
});
