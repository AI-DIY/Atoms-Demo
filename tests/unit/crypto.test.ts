import { describe, expect, it } from "vitest";
import { decryptSecret, encryptSecret, decryptPersistedSecret, encryptPersistedSecret } from "@/lib/crypto";

describe("secret encryption", () => {
  it("round trips a secret without storing it in plaintext", () => {
    const encrypted = encryptSecret("sk-test-key", "test-encryption-secret");

    expect(encrypted).not.toContain("sk-test-key");
    expect(decryptSecret(encrypted, "test-encryption-secret")).toBe("sk-test-key");
  });

  it("rejects a missing encryption secret", () => {
    expect(() => encryptSecret("sk-test-key", "")).toThrow("encryption secret");
  });

  it("persists its application encryption key without an environment variable", async () => {
    const encrypted = await encryptPersistedSecret("sk-persisted-key");

    await expect(decryptPersistedSecret(encrypted)).resolves.toBe("sk-persisted-key");
  });
});
