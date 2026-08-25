#!/usr/bin/env node

const { createDecipheriv, createHash } = require("node:crypto");
const { execFileSync } = require("node:child_process");
const { chmodSync, chownSync, copyFileSync, existsSync, readFileSync, renameSync, writeFileSync } = require("node:fs");
const path = require("node:path");

const environmentFile = process.env.AGENT_STUDIO_ENV_FILE || "/etc/agent-studio.env";
const databaseFile = process.env.AGENT_STUDIO_DATABASE_FILE || "/var/lib/agent-studio/agent-studio.db";
const secretFile = "/var/lib/agent-studio/.model-config-secret";
const email = process.argv[2] || "abc@163.com";
const managedKeys = new Set([
  "RESPONSES_API_BASE_URL",
  "RESPONSES_API_KEY",
  "RESPONSES_MODEL",
  "RESPONSES_MAX_OUTPUT_TOKENS",
  "RESPONSES_REASONING_EFFORT",
  "MOCK_LLM",
]);

function quoted(value) {
  return `"${value.replaceAll("\\", "\\\\").replaceAll("\"", "\\\"")}"`;
}

function decrypt(ciphertext, secret) {
  const [version, iv, tag, encrypted] = ciphertext.split(":");

  if (version !== "v1" || !iv || !tag || !encrypted) {
    throw new Error("Stored API key has an invalid format");
  }

  const decipher = createDecipheriv(
    "aes-256-gcm",
    createHash("sha256").update(secret).digest(),
    Buffer.from(iv, "base64url"),
  );
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, "base64url")),
    decipher.final(),
  ]).toString("utf8");
}

function agentStudioGroupId() {
  const entry = execFileSync("getent", ["group", "agentstudio"], { encoding: "utf8" }).trim();
  const groupId = Number(entry.split(":")[2]);

  if (!Number.isInteger(groupId)) {
    throw new Error("The agentstudio group is required");
  }

  return groupId;
}

function storedConfiguration() {
  const escapedEmail = email.replaceAll("'", "''");
  const query = [
    "SELECT m.baseUrl, m.apiKeyCiphertext, m.modelId,",
    "COALESCE(m.maxOutputTokens, 4096), COALESCE(m.reasoningEffort, 'medium')",
    "FROM User u JOIN ModelConfig m ON m.userId = u.id",
    `WHERE u.email = '${escapedEmail}' LIMIT 1;`,
  ].join(" ");
  const output = execFileSync(
    "sqlite3",
    ["-separator", "\u001f", databaseFile, query],
    { encoding: "utf8" },
  ).trim();

  if (!output) {
    throw new Error(`No stored model configuration found for ${email}`);
  }

  const [baseUrl, apiKeyCiphertext, model, maxOutputTokens, reasoningEffort] = output.split("\u001f");
  const apiKey = decrypt(apiKeyCiphertext, readFileSync(secretFile, "utf8").trim());

  if (!/^https?:\/\/\S+$/u.test(baseUrl) || !apiKey || !model) {
    throw new Error("Stored model configuration is incomplete");
  }

  if (!/^\d+$/u.test(maxOutputTokens) || Number(maxOutputTokens) < 256 || Number(maxOutputTokens) > 32_768) {
    throw new Error("Stored maximum output tokens is invalid");
  }

  if (!["none", "low", "medium", "high"].includes(reasoningEffort)) {
    throw new Error("Stored reasoning effort is invalid");
  }

  return { baseUrl, apiKey, model, maxOutputTokens, reasoningEffort };
}

function writeEnvironment(config) {
  const current = existsSync(environmentFile)
    ? readFileSync(environmentFile, "utf8")
    : "DATABASE_URL=\"file:/var/lib/agent-studio/agent-studio.db\"\nMOCK_LLM=\"false\"\n";
  const kept = current.split(/\r?\n/u).filter((line) => !managedKeys.has(line.split("=", 1)[0]));
  const body = kept.join("\n").replace(/\n*$/u, "\n");
  const content = `${body}\n# Managed Responses API configuration\n`
    + `RESPONSES_API_BASE_URL=${quoted(config.baseUrl)}\n`
    + `RESPONSES_API_KEY=${quoted(config.apiKey)}\n`
    + `RESPONSES_MODEL=${quoted(config.model)}\n`
    + `RESPONSES_MAX_OUTPUT_TOKENS=${quoted(config.maxOutputTokens)}\n`
    + `RESPONSES_REASONING_EFFORT=${quoted(config.reasoningEffort)}\n`
    + "MOCK_LLM=\"false\"\n";
  const groupId = agentStudioGroupId();
  const temporaryFile = path.join(path.dirname(environmentFile), `.${path.basename(environmentFile)}.${process.pid}`);

  if (existsSync(environmentFile)) {
    const backupFile = `${environmentFile}.bak.${new Date().toISOString().replaceAll(/[-:.TZ]/gu, "")}`;
    copyFileSync(environmentFile, backupFile);
    chmodSync(backupFile, 0o640);
    chownSync(backupFile, 0, groupId);
  }

  writeFileSync(temporaryFile, content, { mode: 0o640 });
  chmodSync(temporaryFile, 0o640);
  chownSync(temporaryFile, 0, groupId);
  renameSync(temporaryFile, environmentFile);
}

if (process.getuid && process.getuid() !== 0) {
  throw new Error("Run this script as root");
}

writeEnvironment(storedConfiguration());
console.log(`Migrated ${email}'s encrypted model configuration to ${environmentFile}.`);
