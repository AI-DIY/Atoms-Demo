import { describe, expect, it } from "vitest";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import {
  decryptSecret,
  encryptSecret,
  decryptPersistedSecret,
  encryptPersistedSecret,
  getOrCreatePersistedSecret,
} from "@/lib/crypto";

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

  it("creates a persisted secret at a requested path", () => {
    const fixtureDirectory = mkdtempSync(path.join(tmpdir(), "agent-studio-crypto-"));
    const secretPath = path.join(fixtureDirectory, "state", ".model-config-secret");

    try {
      const secret = getOrCreatePersistedSecret(secretPath);

      expect(secret).toHaveLength(43);
      expect(readFileSync(secretPath, "utf8").trim()).toBe(secret);
      expect(getOrCreatePersistedSecret(secretPath)).toBe(secret);
    } finally {
      rmSync(fixtureDirectory, { recursive: true, force: true });
    }
  });

  it.runIf(process.platform !== "win32")("initializes the target of a dangling persisted-secret symlink", () => {
    const fixtureDirectory = mkdtempSync(path.join(tmpdir(), "agent-studio-crypto-"));
    const linkedSecretPath = path.join(fixtureDirectory, "runtime", "prisma", ".model-config-secret");
    const persistentSecretPath = path.join(fixtureDirectory, "state", ".model-config-secret");

    try {
      mkdirSync(path.dirname(linkedSecretPath), { recursive: true });
      symlinkSync(persistentSecretPath, linkedSecretPath, "file");

      const secret = getOrCreatePersistedSecret(linkedSecretPath);

      expect(secret).toHaveLength(43);
      expect(readFileSync(persistentSecretPath, "utf8").trim()).toBe(secret);
      expect(getOrCreatePersistedSecret(linkedSecretPath)).toBe(secret);
    } finally {
      rmSync(fixtureDirectory, { recursive: true, force: true });
    }
  });
});
