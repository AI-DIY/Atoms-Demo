import { z } from "zod";
import type { ArtifactType } from "@/lib/domain";
import { sanitizeGeneratedHtml } from "@/lib/html-sanitize";

const listOfStrings = z.array(z.string().trim().min(1).max(500)).min(1).max(20);

const artifactSchemas = {
  plan: z.object({
    roles: z.tuple([z.literal("pm"), z.literal("architect"), z.literal("engineer")]),
    risks: z.array(z.string().trim().min(1).max(500)).max(3),
  }),
  prd: z.object({
    users: listOfStrings,
    scope: listOfStrings,
    flow: listOfStrings,
    acceptance: listOfStrings,
  }),
  architecture: z.object({
    pages: listOfStrings,
    state: listOfStrings,
    constraints: listOfStrings,
  }),
  app: z.object({
    title: z.string().trim().min(1).max(80),
    html: z.string().min(80).max(50_000),
  }),
  research: z.object({
    findings: listOfStrings,
    assumptions: listOfStrings,
  }),
  analysis: z.object({
    metrics: listOfStrings,
    questions: listOfStrings,
  }),
  seo: z.object({
    keywords: listOfStrings,
    recommendations: listOfStrings,
  }),
  growth: z.object({
    experiments: listOfStrings,
    successMetric: z.string().trim().min(1).max(500),
  }),
} satisfies Record<ArtifactType, z.ZodType>;

export type ArtifactContentByType = {
  [Type in ArtifactType]: z.infer<(typeof artifactSchemas)[Type]>;
};

export type ParsedArtifact = {
  [Type in ArtifactType]: {
    type: Type;
    content: ArtifactContentByType[Type];
  };
}[ArtifactType];

export type PlanArtifact = Extract<ParsedArtifact, { type: "plan" }>;
export type PrdArtifact = Extract<ParsedArtifact, { type: "prd" }>;
export type ArchitectureArtifact = Extract<
  ParsedArtifact,
  { type: "architecture" }
>;
export type AppArtifact = Extract<ParsedArtifact, { type: "app" }>;

const acceptanceMarker =
  /\bdata-acceptance\s*=\s*(?:"([^"]*)"|'([^']*)')/giu;

export function assertAcceptanceCoverage(
  prd: PrdArtifact,
  app: AppArtifact,
): void {
  const markers = new Set<string>();

  for (const match of app.content.html.matchAll(acceptanceMarker)) {
    markers.add((match[1] ?? match[2] ?? "").trim());
  }

  const missing = prd.content.acceptance.filter(
    (criterion) => !markers.has(criterion),
  );

  if (missing.length > 0) {
    throw new Error(`App acceptance coverage missing: ${missing.join(", ")}`);
  }
}

export function parseArtifact<Type extends ArtifactType>(
  type: Type,
  content: unknown,
): Extract<ParsedArtifact, { type: Type }> {
  if (type === "app") {
    const parsedApp = artifactSchemas.app.safeParse(content);

    if (!parsedApp.success) {
      throw new Error("Invalid app artifact");
    }

    return {
      type,
      content: {
        ...parsedApp.data,
        html: sanitizeGeneratedHtml(parsedApp.data.html),
      },
    } as Extract<ParsedArtifact, { type: Type }>;
  }

  const parsed = artifactSchemas[type].safeParse(content);

  if (!parsed.success) {
    throw new Error(`Invalid ${type} artifact`);
  }

  return { type, content: parsed.data } as Extract<
    ParsedArtifact,
    { type: Type }
  >;
}
