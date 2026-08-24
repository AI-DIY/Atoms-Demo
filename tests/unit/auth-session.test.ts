import { afterEach, describe, expect, it, vi } from "vitest";
import { setSessionCookie } from "@/lib/auth-session";

const expiresAt = new Date("2026-09-01T00:00:00.000Z");

describe("setSessionCookie", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("does not mark a production HTTP session cookie as Secure", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = new Response();
    const request = new Request("http://agent-studio.example.com/api/auth/login", {
      headers: { "x-forwarded-proto": "http" },
    });

    setSessionCookie(response, "session-token", expiresAt, request);

    expect(response.headers.get("set-cookie")).not.toContain("; Secure");
  });

  it("marks a production HTTPS session cookie as Secure", () => {
    vi.stubEnv("NODE_ENV", "production");
    const response = new Response();
    const request = new Request("http://agent-studio.example.com/api/auth/login", {
      headers: { "x-forwarded-proto": "https" },
    });

    setSessionCookie(response, "session-token", expiresAt, request);

    expect(response.headers.get("set-cookie")).toContain("; Secure");
  });
});
