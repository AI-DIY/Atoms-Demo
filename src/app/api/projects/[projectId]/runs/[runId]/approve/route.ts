import { NextResponse } from "next/server";
import { z } from "zod";
import { parseArtifact, type PlanArtifact } from "@/lib/artifacts";
import { getAgentProvider } from "@/lib/env";
import {
  approvePlan,
  buildApprovedPlan,
  type TeamPlan,
  type TeamRunCallbacks,
} from "@/lib/orchestrator";
import {
  appendMessage,
  completeRun,
  createRunStep,
  createVersion,
  getRun,
  updateProjectStatus,
  updateRun,
} from "@/lib/repository";
import { encodeRunEvent, type RunEventName } from "@/lib/run-events";

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

function sseResponse(events: string[]) {
  return new Response(events.join(""), {
    headers: {
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "content-type": "text/event-stream; charset=utf-8",
    },
  });
}

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
  events: string[],
): TeamRunCallbacks {
  const emit = (name: RunEventName, data: unknown) => {
    events.push(encodeRunEvent(name, data));
  };

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

  if (!ownerToken) {
    return notFoundResponse();
  }

  const { projectId, runId } = await params;
  let run;

  try {
    run = await getRun(projectId, ownerToken, runId);
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
    provider = getAgentProvider();
    plan = approvePlan(readStoredPlan(run.planJson));
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  const events: string[] = [];

  try {
    await updateRun(projectId, ownerToken, run.id, { status: "building" });
    await updateProjectStatus(projectId, ownerToken, "building");
    const result = await buildApprovedPlan(
      provider,
      plan,
      persistentCallbacks(projectId, ownerToken, run.id, events),
    );
    const version = await createVersion(projectId, ownerToken, {
      title: result.app.content.title,
      html: result.app.content.html,
      sourceRunId: run.id,
    });

    await completeRun(projectId, ownerToken, run.id, { status: "completed" });
    await updateProjectStatus(projectId, ownerToken, "ready");
    events.push(encodeRunEvent("run.completed", { runId: run.id, versionId: version.id }));

    return sseResponse(events);
  } catch (error) {
    await completeRun(projectId, ownerToken, run.id, {
      status: "failed",
      errorCode: "build_failed",
    });
    await updateProjectStatus(projectId, ownerToken, "failed");
    events.push(encodeRunEvent("run.failed", { runId: run.id, error: errorMessage(error) }));

    return sseResponse(events);
  }
}
