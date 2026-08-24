import { createCipheriv, createDecipheriv, createHash, randomBytes } from "node:crypto";
import { lstatSync, mkdirSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const algorithm = "aes-256-gcm";
const version = "v1";

function keyFromSecret(secret: string | undefined): Buffer {
  if (!secret?.trim()) {
    throw new Error("encryption secret is required");
  }

  return createHash("sha256").update(secret).digest();
}

const persistedSecretPath = process.env.NODE_ENV === "production" && process.platform === "linux"
  ? "/var/lib/agent-studio/.model-config-secret"
  : path.join(process.cwd(), "prisma", ".model-config-secret");

function resolvedSecretPath(secretPath: string): string {
  try {
    if (lstatSync(secretPath).isSymbolicLink()) {
      return path.resolve(path.dirname(secretPath), readlinkSync(secretPath));
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  return secretPath;
}

export function getOrCreatePersistedSecret(secretPath = persistedSecretPath): string {
  const storagePath = resolvedSecretPath(secretPath);

  try {
    return readFileSync(storagePath, "utf8").trim();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
      throw error;
    }
  }

  const secret = randomBytes(32).toString("base64url");
  mkdirSync(path.dirname(storagePath), { recursive: true });
  try {
    writeFileSync(storagePath, `${secret}\n`, { mode: 0o600, flag: "wx" });
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
      throw error;
    }
    return readFileSync(storagePath, "utf8").trim();
  }
  return secret;
}

function persistedSecret(): string {
  return getOrCreatePersistedSecret();
}

export function encryptSecret(value: string, secret = persistedSecret()): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv(algorithm, keyFromSecret(secret), iv);
  const encrypted = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();

  return [version, iv.toString("base64url"), tag.toString("base64url"), encrypted.toString("base64url")].join(":");
}

export function decryptSecret(payload: string, secret = persistedSecret()): string {
  const [payloadVersion, ivText, tagText, encryptedText] = payload.split(":");

  if (payloadVersion !== version || !ivText || !tagText || !encryptedText) {
    throw new Error("Invalid encrypted secret");
  }

  const decipher = createDecipheriv(
    algorithm,
    keyFromSecret(secret),
    Buffer.from(ivText, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tagText, "base64url"));

  return Buffer.concat([
    decipher.update(Buffer.from(encryptedText, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

export async function encryptPersistedSecret(value: string): Promise<string> {
  return encryptSecret(value, persistedSecret());
}

export async function decryptPersistedSecret(payload: string): Promise<string> {
  return decryptSecret(payload, persistedSecret());
}
