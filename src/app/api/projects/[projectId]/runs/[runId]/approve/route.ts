import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-session";
import { parseArtifact, type PlanArtifact } from "@/lib/artifacts";
import { getAgentProvider } from "@/lib/env";
import { modelConfigForProvider } from "@/lib/model-config";
import { allowModelStart, teamGenerationGate } from "@/lib/execution-limits";
import {
  approvePlan,
  buildApprovedPlan,
  type TeamPlan,
  type TeamRunCallbacks,
} from "@/lib/orchestrator";
import {
  appendMessage,
  claimRunForApproval,
  completeRun,
  createRunStep,
  createVersion,
  getRun,
  getProjectForUser,
  updateProjectStatus,
} from "@/lib/repository";
import { getModelConfig } from "@/lib/user-repository";
import { streamRunEvents, type RunEventEmitter } from "@/lib/run-events";

const storedPlan = z.object({
  goal: z.string().trim().min(1).max(2_000),
  artifact: z.object({
    type: z.literal("plan"),
    content: z.unknown(),
  }),
});

type RouteContext = {
  params: Promise<{ projectId: string; runId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Run failed";
}

function readStoredPlan(planJson: string | null): TeamPlan {
  if (!planJson) {
    throw new Error("Run plan is missing");
  }

  let parsedJson: unknown;

  try {
    parsedJson = JSON.parse(planJson);
  } catch {
    throw new Error("Run plan is invalid");
  }

  const parsedPlan = storedPlan.safeParse(parsedJson);

  if (!parsedPlan.success) {
    throw new Error("Run plan is invalid");
  }

  return {
    goal: parsedPlan.data.goal,
    approved: false,
    artifact: parseArtifact("plan", parsedPlan.data.artifact.content) as PlanArtifact,
    steps: [],
  };
}

function persistentCallbacks(
  projectId: string,
  ownerToken: string,
  runId: string,
  emit: RunEventEmitter,
): TeamRunCallbacks {
  return {
    onStepStarted(role) {
      emit("step.started", { runId, role });
    },
    async onStepCompleted(step) {
      await createRunStep(projectId, ownerToken, runId, {
        role: step.role,
        status: step.status,
        inputSummary: step.summary,
        artifactType: step.artifact.type,
        artifactJson: JSON.stringify(step.artifact.content),
      });
      await appendMessage(projectId, ownerToken, {
        role: step.role,
        kind: "assistant",
        content: step.summary,
      });
      emit("step.completed", {
        runId,
        role: step.role,
        artifactType: step.artifact.type,
      });
    },
  };
}

export async function POST(request: Request, { params }: RouteContext) {
  const ownerToken = request.headers.get("x-project-token");

  const { projectId, runId } = await params;
  const user = await getCurrentUser(request);
  let effectiveOwnerToken = ownerToken;
  let run;

  try {
    if (user) {
      const project = await getProjectForUser(projectId, user.id);
      effectiveOwnerToken = project.ownerToken;
    }
    if (!effectiveOwnerToken) return notFoundResponse();
    run = await getRun(projectId, effectiveOwnerToken, runId);
  } catch (error) {
    if (errorMessage(error) === "Project not found" || errorMessage(error) === "Run not found") {
      return notFoundResponse();
    }

    throw error;
  }

  if (run.mode !== "team" || run.status !== "awaiting_approval") {
    return NextResponse.json({ error: "Run is not awaiting approval" }, { status: 409 });
  }

  let provider;
  let plan: TeamPlan;

  try {
    const config = user ? await getModelConfig(user.id) : null;
    if (user && !config) {
      return NextResponse.json({ error: "请先完成模型配置" }, { status: 503 });
    }
    provider = getAgentProvider(process.env, undefined, config ? await modelConfigForProvider(config) : undefined);
    plan = approvePlan(readStoredPlan(run.planJson));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  if (!allowModelStart(request)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后重试。" }, { status: 429 });
  }

  let release: () => void;

  try {
    release = await teamGenerationGate.acquire();
  } catch {
    return NextResponse.json({ error: "服务器正忙，请稍后重试。" }, { status: 503 });
  }

  let claimed: boolean;

  try {
    claimed = await claimRunForApproval(projectId, effectiveOwnerToken!, run.id);
  } catch {
    release();
    return NextResponse.json({ error: "暂时无法开始构建，请稍后重试。" }, { status: 503 });
  }

  if (!claimed) {
    release();
    return NextResponse.json({ error: "Run is not awaiting approval" }, { status: 409 });
  }

  return streamRunEvents(run.id, async (emit) => {
    try {
      emit("run.started", { runId: run.id, mode: run.mode });

      try {
        await updateProjectStatus(projectId, effectiveOwnerToken!, "building");
        const result = await buildApprovedPlan(
          provider,
          plan,
          persistentCallbacks(projectId, effectiveOwnerToken!, run.id, emit),
        );
        const version = await createVersion(projectId, effectiveOwnerToken!, {
          title: result.app.content.title,
          html: result.app.content.html,
          sourceRunId: run.id,
        });

        await completeRun(projectId, effectiveOwnerToken!, run.id, { status: "completed" });
        await updateProjectStatus(projectId, effectiveOwnerToken!, "ready");
        emit("run.completed", { runId: run.id, versionId: version.id });
      } catch (error) {
        await completeRun(projectId, effectiveOwnerToken!, run.id, {
          status: "failed",
          errorCode: "build_failed",
        });
        await updateProjectStatus(projectId, effectiveOwnerToken!, "failed");
        emit("run.failed", { runId: run.id, error: errorMessage(error) });
      }
    } finally {
      release();
    }
  });
}
