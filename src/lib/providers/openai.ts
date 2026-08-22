import OpenAI from "openai";
import { parseArtifact } from "@/lib/artifacts";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import { getRole } from "@/lib/roles";
import type { RoleId } from "@/lib/domain";

export type ResponsesRequest = {
  model: string;
  instructions: string;
  input: string;
  text?: { format: { type: "json_object" } };
};

export type ResponsesClient = {
  responses: {
    create: (request: ResponsesRequest) => Promise<{ output_text: string }>;
  };
};

type OpenAIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
};

type OpenAIProviderDependencies = {
  client?: ResponsesClient;
  createClient?: (options: { baseURL: string; apiKey: string }) => ResponsesClient;
};

function strictJsonInstruction(role: RoleId) {
  const expectedType = getRole(role).artifactType;

  return [
    getRole(role).systemInstruction,
    "返回一个严格 JSON 对象，且不包含 Markdown 或其他文本。",
    `对象必须匹配 {summary, artifact:{type,content}, suggestedNextAction?}，artifact.type 必须为 ${expectedType}。`,
  ].join("\n");
}

function fallbackJsonInstruction(role: RoleId) {
  return `${strictJsonInstruction(role)}\n此端点不支持结构化输出。只输出一个 JSON 对象。`;
}

function isObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function parseOutput(role: RoleId, outputText: string): AgentOutput {
  let output: unknown;

  try {
    output = JSON.parse(outputText);
  } catch {
    throw new Error("Model response is not valid JSON");
  }

  if (!isObject(output) || typeof output.summary !== "string" || !isObject(output.artifact)) {
    throw new Error("Model response has an invalid shape");
  }

  const artifact = output.artifact;
  const expectedType = getRole(role).artifactType;

  if (artifact.type !== expectedType) {
    throw new Error("Unexpected artifact type");
  }

  if (output.suggestedNextAction !== undefined && typeof output.suggestedNextAction !== "string") {
    throw new Error("Model response has an invalid shape");
  }

  return {
    summary: output.summary,
    artifact: parseArtifact(expectedType, artifact.content),
    suggestedNextAction: output.suggestedNextAction,
  };
}

function isStructuredOutputUnsupported(error: unknown): boolean {
  if (!isObject(error) || (error.status !== 400 && error.status !== 422)) {
    return false;
  }

  const message = typeof error.message === "string" ? error.message : "";
  return /(?:unknown|unrecognized|unsupported|not supported|invalid).*(?:text|format|json)|(?:text|format|json).*(?:unknown|unrecognized|unsupported|not supported|invalid)/iu.test(message);
}

function safeError(error: unknown, apiKey: string): Error {
  const message = error instanceof Error ? error.message : "Model request failed";
  return new Error(message.split(apiKey).join("[REDACTED]"));
}

export function createOpenAIProvider(
  config: OpenAIProviderConfig,
  dependencies: OpenAIProviderDependencies = {},
): AgentProvider {
  if (![config.baseUrl, config.apiKey, config.model].every((value) => value.trim().length > 0)) {
    throw new Error("Model configuration is incomplete");
  }

  const client = dependencies.client
    ?? dependencies.createClient?.({ baseURL: config.baseUrl, apiKey: config.apiKey })
    ?? new OpenAI({ baseURL: config.baseUrl, apiKey: config.apiKey }) as unknown as ResponsesClient;

  return {
    async generate(role, context) {
      const input = JSON.stringify({
        goal: context.goal,
        request: context.request,
        artifacts: context.artifacts,
      });
      let response: { output_text: string };

      try {
        response = await client.responses.create({
          model: config.model,
          instructions: strictJsonInstruction(role),
          input,
          text: { format: { type: "json_object" } },
        });
      } catch (error) {
        if (!isStructuredOutputUnsupported(error)) {
          throw safeError(error, config.apiKey);
        }

        try {
          response = await client.responses.create({
            model: config.model,
            instructions: fallbackJsonInstruction(role),
            input,
          });
        } catch (fallbackError) {
          throw safeError(fallbackError, config.apiKey);
        }
      }

      return parseOutput(role, response.output_text);
    },
  };
}
