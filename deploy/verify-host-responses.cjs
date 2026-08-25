#!/usr/bin/env node

const { readFileSync } = require("node:fs");

const environmentFile = process.env.AGENT_STUDIO_ENV_FILE || "/etc/agent-studio.env";

function readEnvironment(file) {
  const values = {};

  for (const line of readFileSync(file, "utf8").split(/\r?\n/u)) {
    const separator = line.indexOf("=");
    if (separator <= 0 || line.trimStart().startsWith("#")) continue;

    const key = line.slice(0, separator).trim();
    const rawValue = line.slice(separator + 1).trim();
    values[key] = rawValue.startsWith("\"") && rawValue.endsWith("\"")
      ? rawValue.slice(1, -1).replace(/\\([\\"])/gu, "$1")
      : rawValue;
  }

  return values;
}

async function main() {
  const environment = readEnvironment(environmentFile);
  const baseURL = environment.RESPONSES_API_BASE_URL;
  const apiKey = environment.RESPONSES_API_KEY;
  const model = environment.RESPONSES_MODEL;

  if (!baseURL || !apiKey || !model) {
    throw new Error("Host Responses API configuration is incomplete");
  }

  const imported = require("openai");
  const OpenAI = imported.default || imported;
  const client = new OpenAI({
    baseURL,
    apiKey,
    fetch: globalThis.fetch.bind(globalThis),
    maxRetries: 0,
  });
  const response = await client.responses.create({
    model,
    input: "Reply with exactly the word pong.",
    max_output_tokens: 16,
  });

  console.log(JSON.stringify({
    ok: true,
    model,
    receivedOutput: typeof response.output_text === "string" && response.output_text.length > 0,
  }));
}

main().catch((error) => {
  const apiKey = readEnvironment(environmentFile).RESPONSES_API_KEY;
  const message = error instanceof Error ? error.message : "Responses API request failed";
  console.error(apiKey ? message.split(apiKey).join("[REDACTED]") : message);
  process.exitCode = 1;
});
