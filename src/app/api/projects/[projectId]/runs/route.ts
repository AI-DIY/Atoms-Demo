import { NextResponse } from "next/server";
import { z } from "zod";
import { getAgentProvider } from "@/lib/env";
import { createTeamPlan, type TeamRunCallbacks } from "@/lib/orchestrator";
import {
  appendMessage,
  completeRun,
  createRun,
  createRunStep,
  getProject,
  updateProjectStatus,
  updateRun,
} from "@/lib/repository";
import { encodeRunEvent, type RunEventName } from "@/lib/run-events";

const createRunInput = z
  .object({
    mode: z.literal("team"),
    request: z.string().trim().min(1).max(2_000),
  })
  .strict();

type RouteContext = {
  params: Promise<{ projectId: string }>;
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

async function parseJson(request: Request): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    return undefined;
  }
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

  const input = createRunInput.safeParse(await parseJson(request));

  if (!input.success) {
    return NextResponse.json({ error: "Invalid run input" }, { status: 400 });
  }

  const { projectId } = await params;

  try {
    await getProject(projectId, ownerToken);
  } catch (error) {
    if (errorMessage(error) === "Project not found") {
      return notFoundResponse();
    }

    throw error;
  }

  let provider;

  try {
    provider = getAgentProvider();
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  const run = await createRun(projectId, ownerToken, {
    mode: input.data.mode,
    status: "planning",
  });
  const events = [encodeRunEvent("run.started", { runId: run.id, mode: run.mode })];

  try {
    const plan = await createTeamPlan(
      provider,
      input.data.request,
      persistentCallbacks(projectId, ownerToken, run.id, events),
    );

    await updateRun(projectId, ownerToken, run.id, {
      status: "awaiting_approval",
      planJson: JSON.stringify({ goal: plan.goal, artifact: plan.artifact }),
    });
    await updateProjectStatus(projectId, ownerToken, "awaiting_approval");
    events.push(encodeRunEvent("run.awaiting_approval", { runId: run.id }));

    return sseResponse(events);
  } catch (error) {
    await completeRun(projectId, ownerToken, run.id, {
      status: "failed",
      errorCode: "plan_failed",
    });
    await updateProjectStatus(projectId, ownerToken, "failed");
    events.push(encodeRunEvent("run.failed", { runId: run.id, error: errorMessage(error) }));

    return sseResponse(events);
  }
}
