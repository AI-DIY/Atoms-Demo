import type { RoleId } from "@/lib/domain";
import {
  assertAcceptanceCoverage,
  parseArtifact,
  type AppArtifact,
  type ParsedArtifact,
  type PlanArtifact,
  type PrdArtifact,
} from "@/lib/artifacts";
import type { AgentContext, AgentOutput, AgentProvider } from "@/lib/provider";
import { getRole } from "@/lib/roles";

export type TeamStep = {
  role: RoleId | "reviewer";
  status: "completed";
  summary: string;
  artifact: ParsedArtifact;
  suggestedNextAction?: string;
};

export type TeamPlan = {
  goal: string;
  approved: boolean;
  artifact: PlanArtifact;
  steps: readonly TeamStep[];
};

export type ApprovedTeamPlan = TeamPlan & { approved: true };

export type ApprovedTeamBuild = ApprovedTeamPlan & {
  app: AppArtifact;
};

type ExpectedRole = "leader" | "pm" | "architect" | "engineer";
type TeamRole = ExpectedRole | "reviewer";

export type TeamRunCallbacks = {
  onStepStarted?: (role: TeamRole) => Promise<void> | void;
  onStepCompleted?: (step: TeamStep) => Promise<void> | void;
};

export type SpecialistStep = {
  role: RoleId;
  status: "completed";
  summary: string;
  artifact: ParsedArtifact;
  suggestedNextAction?: string;
};

export type SpecialistRunCallbacks = {
  onStepStarted?: (role: RoleId) => Promise<void> | void;
  onStepCompleted?: (step: SpecialistStep) => Promise<void> | void;
};

const expectedArtifacts: Record<ExpectedRole, ParsedArtifact["type"]> = {
  leader: "plan",
  pm: "prd",
  architect: "architecture",
  engineer: "app",
};

async function runRole(
  provider: AgentProvider,
  role: ExpectedRole,
  context: AgentContext,
  callbacks?: TeamRunCallbacks,
): Promise<TeamStep> {
  await callbacks?.onStepStarted?.(role);
  const output: AgentOutput = await provider.generate(role, context);
  const expectedType = expectedArtifacts[role];

  if (output.artifact.type !== expectedType) {
    throw new Error(`Expected ${expectedType} artifact from ${role}`);
  }

  const step: TeamStep = {
    role,
    status: "completed",
    summary: output.summary,
    artifact: parseArtifact(expectedType, output.artifact.content),
    suggestedNextAction: output.suggestedNextAction,
  };

  await callbacks?.onStepCompleted?.(step);
  return step;
}

async function runSpecialistRole(
  provider: AgentProvider,
  role: RoleId,
  context: AgentContext,
  callbacks?: SpecialistRunCallbacks,
): Promise<SpecialistStep> {
  await callbacks?.onStepStarted?.(role);
  const output = await provider.generate(role, context);
  const expectedType = getRole(role).artifactType;

  if (output.artifact.type !== expectedType) {
    throw new Error(`Expected ${expectedType} artifact from ${role}`);
  }

  const step: SpecialistStep = {
    role,
    status: "completed",
    summary: output.summary,
    artifact: parseArtifact(expectedType, output.artifact.content),
    suggestedNextAction: output.suggestedNextAction,
  };

  await callbacks?.onStepCompleted?.(step);
  return step;
}

export async function runMention(
  provider: AgentProvider,
  role: RoleId,
  goal: string,
  request: string,
  callbacks?: SpecialistRunCallbacks,
): Promise<SpecialistStep> {
  return runSpecialistRole(provider, role, { goal, request, artifacts: [] }, callbacks);
}

export async function runIteration(
  provider: AgentProvider,
  goal: string,
  request: string,
  currentApp: AppArtifact,
  callbacks?: TeamRunCallbacks,
): Promise<TeamStep> {
  return runRole(provider, "engineer", {
    goal,
    request,
    artifacts: [currentApp],
  }, callbacks);
}

export async function createTeamPlan(
  provider: AgentProvider,
  goal: string,
  callbacks?: TeamRunCallbacks,
): Promise<TeamPlan> {
  const leaderStep = await runRole(provider, "leader", {
    goal,
    request: "制定默认交付团队计划，并标注实施风险与处理方式。",
    artifacts: [],
  }, callbacks);

  return {
    goal,
    approved: false,
    artifact: leaderStep.artifact as PlanArtifact,
    steps: [leaderStep],
  };
}

export function approvePlan(plan: TeamPlan): ApprovedTeamPlan {
  return {
    ...plan,
    approved: true,
    steps: [...plan.steps],
  };
}

export async function buildApprovedPlan(
  provider: AgentProvider,
  plan: TeamPlan,
  callbacks?: TeamRunCallbacks,
): Promise<ApprovedTeamBuild> {
  if (!plan.approved) {
    throw new Error("Team plan must be approved before building");
  }

  const validatedPlan = parseArtifact("plan", plan.artifact.content);
  const pmStep = await runRole(provider, "pm", {
    goal: plan.goal,
    request: "根据团队计划整理产品需求和验收标准。",
    artifacts: [validatedPlan],
  }, callbacks);
  const architectStep = await runRole(provider, "architect", {
    goal: plan.goal,
    request: "根据团队计划和产品需求确定页面、状态与约束。",
    artifacts: [validatedPlan, pmStep.artifact],
  }, callbacks);
  const engineerStep = await runRole(provider, "engineer", {
    goal: plan.goal,
    request: "根据已验证的需求与架构交付可交互的单文件网页应用。",
    artifacts: [validatedPlan, pmStep.artifact, architectStep.artifact],
  }, callbacks);

  // Reviewer is deterministic: it validates the already-sanitized app without a model call.
  await callbacks?.onStepStarted?.("reviewer");
  const app = parseArtifact("app", engineerStep.artifact.content);
  const prd = pmStep.artifact as PrdArtifact;
  assertAcceptanceCoverage(prd, app);
  const reviewerStep: TeamStep = {
    role: "reviewer",
    status: "completed",
    summary: `已完成应用产物结构、安全边界与 ${prd.content.acceptance.length} 条验收条件覆盖校验。`,
    artifact: app,
  };
  await callbacks?.onStepCompleted?.(reviewerStep);

  return {
    ...plan,
    approved: true,
    artifact: validatedPlan,
    steps: [...plan.steps, pmStep, architectStep, engineerStep, reviewerStep],
    app,
  };
}
