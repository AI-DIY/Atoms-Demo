import OpenAI from "openai";
import { parseArtifact } from "@/lib/artifacts";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import { getRole } from "@/lib/roles";
import type { ArtifactType, RoleId } from "@/lib/domain";

type JsonSchema = Record<string, unknown>;

type JsonSchemaFormat = {
  type: "json_schema";
  name: "agent_output";
  strict: true;
  schema: JsonSchema;
};

export type ResponsesRequest = {
  model: string;
  instructions: string;
  input: string;
  max_output_tokens?: number;
  reasoning?: { effort: "none" | "low" | "medium" | "high" };
  text?: { format: JsonSchemaFormat };
};

export type ResponsesClient = {
  responses: {
    create: (request: ResponsesRequest) => Promise<{ output_text: string }>;
  };
};

export type OpenAIProviderConfig = {
  baseUrl: string;
  apiKey: string;
  model: string;
  modelId?: string;
  displayName?: string;
  notes?: string;
  maxOutputTokens?: number;
  reasoningEffort?: "none" | "low" | "medium" | "high";
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

const shortStringSchema = { type: "string", minLength: 1, maxLength: 500 };
const listOfStringsSchema = {
  type: "array",
  items: shortStringSchema,
  minItems: 1,
  maxItems: 20,
};

const artifactContentSchemas: Record<ArtifactType, JsonSchema> = {
  plan: {
    type: "object",
    properties: {
      roles: {
        type: "array",
        items: { type: "string", enum: ["pm", "architect", "engineer"] },
        minItems: 3,
        maxItems: 3,
      },
      risks: { type: "array", items: shortStringSchema, maxItems: 3 },
    },
    required: ["roles", "risks"],
    additionalProperties: false,
  },
  prd: {
    type: "object",
    properties: {
      users: listOfStringsSchema,
      scope: listOfStringsSchema,
      flow: listOfStringsSchema,
      acceptance: listOfStringsSchema,
    },
    required: ["users", "scope", "flow", "acceptance"],
    additionalProperties: false,
  },
  architecture: {
    type: "object",
    properties: {
      pages: listOfStringsSchema,
      state: listOfStringsSchema,
      constraints: listOfStringsSchema,
    },
    required: ["pages", "state", "constraints"],
    additionalProperties: false,
  },
  app: {
    type: "object",
    properties: {
      title: { type: "string", minLength: 1, maxLength: 80 },
      html: { type: "string", minLength: 80, maxLength: 50_000 },
    },
    required: ["title", "html"],
    additionalProperties: false,
  },
  research: {
    type: "object",
    properties: { findings: listOfStringsSchema, assumptions: listOfStringsSchema },
    required: ["findings", "assumptions"],
    additionalProperties: false,
  },
  analysis: {
    type: "object",
    properties: { metrics: listOfStringsSchema, questions: listOfStringsSchema },
    required: ["metrics", "questions"],
    additionalProperties: false,
  },
  seo: {
    type: "object",
    properties: { keywords: listOfStringsSchema, recommendations: listOfStringsSchema },
    required: ["keywords", "recommendations"],
    additionalProperties: false,
  },
  growth: {
    type: "object",
    properties: {
      experiments: listOfStringsSchema,
      successMetric: shortStringSchema,
    },
    required: ["experiments", "successMetric"],
    additionalProperties: false,
  },
};

function agentOutputSchema(role: RoleId): JsonSchema {
  const artifactType = getRole(role).artifactType;

  return {
    type: "object",
    properties: {
      summary: shortStringSchema,
      artifact: {
        type: "object",
        properties: {
          type: { type: "string", enum: [artifactType] },
          content: artifactContentSchemas[artifactType],
        },
        required: ["type", "content"],
        additionalProperties: false,
      },
      suggestedNextAction: { type: ["string", "null"] },
    },
    required: ["summary", "artifact", "suggestedNextAction"],
    additionalProperties: false,
  };
}

function structuredOutput(role: RoleId): Pick<ResponsesRequest, "text"> {
  return {
    text: {
      format: {
        type: "json_schema",
        name: "agent_output",
        strict: true,
        schema: agentOutputSchema(role),
      },
    },
  };
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

  if (
    output.suggestedNextAction !== undefined
    && output.suggestedNextAction !== null
    && typeof output.suggestedNextAction !== "string"
  ) {
    throw new Error("Model response has an invalid shape");
  }

  return {
    summary: output.summary,
    artifact: parseArtifact(expectedType, artifact.content),
    suggestedNextAction: typeof output.suggestedNextAction === "string"
      ? output.suggestedNextAction
      : undefined,
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

function contextInput(context: AgentContext) {
  return {
    goal: context.goal,
    request: context.request,
    artifacts: context.artifacts,
  };
}

function repairInput(role: RoleId, context: AgentContext, invalidOutput: string): string {
  return JSON.stringify({
    ...contextInput(context),
    schema: agentOutputSchema(role),
    invalidOutput: invalidOutput.slice(0, 50_000),
  });
}

function repairInstruction(role: RoleId): string {
  return `${strictJsonInstruction(role)}\n上一响应未通过 JSON 或产物校验。只输出完整 JSON，不要省略任何字段。`;
}

function optionalRequestConfig(config: OpenAIProviderConfig): Pick<ResponsesRequest, "max_output_tokens" | "reasoning"> {
  return {
    ...(config.maxOutputTokens ? { max_output_tokens: config.maxOutputTokens } : {}),
    ...(config.reasoningEffort ? { reasoning: { effort: config.reasoningEffort } } : {}),
  };
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
      const input = JSON.stringify(contextInput(context));
      let response: { output_text: string };
      let structured = true;

      try {
        response = await client.responses.create({
          model: config.model,
          instructions: strictJsonInstruction(role),
          input,
          ...optionalRequestConfig(config),
          ...structuredOutput(role),
        });
      } catch (error) {
        if (!isStructuredOutputUnsupported(error)) {
          throw safeError(error, config.apiKey);
        }

        structured = false;

        try {
          response = await client.responses.create({
            model: config.model,
            instructions: fallbackJsonInstruction(role),
            input,
            ...optionalRequestConfig(config),
          });
        } catch (fallbackError) {
          throw safeError(fallbackError, config.apiKey);
        }
      }

      try {
        return parseOutput(role, response.output_text);
      } catch {
        let repaired: { output_text: string };

        try {
          repaired = await client.responses.create({
            model: config.model,
            instructions: repairInstruction(role),
            input: repairInput(role, context, response.output_text),
            ...optionalRequestConfig(config),
            ...(structured ? structuredOutput(role) : {}),
          });
        } catch (repairError) {
          throw safeError(repairError, config.apiKey);
        }

        try {
          return parseOutput(role, repaired.output_text);
        } catch {
          throw new Error("Model response is invalid after repair");
        }
      }
    },
  };
}
