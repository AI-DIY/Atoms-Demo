export const projectStatuses = [
  "draft",
  "planning",
  "awaiting_approval",
  "building",
  "reviewing",
  "ready",
  "failed",
  "iterating",
] as const;

export type ProjectStatus = (typeof projectStatuses)[number];
export type ProjectEvent =
  | "plan"
  | "approve"
  | "review"
  | "complete"
  | "iterate"
  | "retry"
  | "fail";

export type RoleId =
  | "leader"
  | "pm"
  | "architect"
  | "engineer"
  | "research"
  | "data"
  | "seo"
  | "growth";

export type ArtifactType =
  | "plan"
  | "prd"
  | "architecture"
  | "app"
  | "research"
  | "analysis"
  | "seo"
  | "growth";

