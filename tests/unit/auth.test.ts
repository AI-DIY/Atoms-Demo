import { describe, expect, it } from "vitest";
import {
  hashPassword,
  normalizeEmail,
  verifyPassword,
} from "@/lib/auth";

describe("auth helpers", () => {
  it("normalizes email addresses before persistence", () => {
    expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
  });

  it("hashes passwords and verifies only the original password", async () => {
    const hashed = await hashPassword("correct horse battery staple");

    expect(hashed).not.toContain("correct horse");
    await expect(verifyPassword("correct horse battery staple", hashed)).resolves.toBe(true);
    await expect(verifyPassword("wrong password", hashed)).resolves.toBe(false);
  });
});
