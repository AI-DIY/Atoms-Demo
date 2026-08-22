import { NextResponse } from "next/server";
import { z } from "zod";
import type { AppArtifact, ParsedArtifact } from "@/lib/artifacts";
import { getAgentProvider } from "@/lib/env";
import { parseFirstMention } from "@/lib/mention";
import {
  createTeamPlan,
  runIteration,
  runMention,
} from "@/lib/orchestrator";
import {
  appendMessage,
  chooseCurrentVersion,
  completeRun,
  createRun,
  createRunStep,
  createVersion,
  getProject,
  updateProjectStatus,
  updateRun,
} from "@/lib/repository";
import { encodeRunEvent, type RunEventName } from "@/lib/run-events";

const runRequest = z.string().trim().min(1).max(2_000);
const createRunInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("team"), request: runRequest }).strict(),
  z.object({ mode: z.literal("mention"), request: runRequest }).strict(),
  z.object({ mode: z.literal("iterate"), request: runRequest }).strict(),
]);

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

type PersistentStep = {
  role: string;
  status: string;
  summary: string;
  artifact: ParsedArtifact;
};

type PersistentCallbacks = {
  onStepStarted: (role: string) => void;
  onStepCompleted: (step: PersistentStep) => Promise<void>;
};

function persistentCallbacks(
  projectId: string,
  ownerToken: string,
  runId: string,
  events: string[],
): PersistentCallbacks {
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
        summary: step.summary,
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

  let project;

  try {
    project = await getProject(projectId, ownerToken);
  } catch (error) {
    if (errorMessage(error) === "Project not found") {
      return notFoundResponse();
    }

    throw error;
  }

  const mentionedRole = input.data.mode === "mention"
    ? parseFirstMention(input.data.request)
    : null;
  let currentApp: AppArtifact | null = null;

  if (input.data.mode === "mention" && !mentionedRole) {
    return NextResponse.json({ error: "Mention is required" }, { status: 400 });
  }

  if (input.data.mode === "iterate") {
    if (parseFirstMention(input.data.request)) {
      return NextResponse.json({ error: "Iteration cannot include a mention" }, { status: 400 });
    }

    if (project.status !== "ready" || project.currentVersion < 1) {
      return NextResponse.json({ error: "Project is not ready for iteration" }, { status: 409 });
    }

    try {
      const current = chooseCurrentVersion(project.versions, project.currentVersion);
      currentApp = {
        type: "app",
        content: { title: current.title, html: current.html },
      };
    } catch {
      return NextResponse.json({ error: "Project is not ready for iteration" }, { status: 409 });
    }
  }

  let provider;

  try {
    provider = getAgentProvider();
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  const run = await createRun(projectId, ownerToken, {
    mode: input.data.mode,
    status: input.data.mode === "team" ? "planning" : "running",
  });
  const events = [encodeRunEvent("run.started", { runId: run.id, mode: run.mode })];

  if (input.data.mode === "mention") {
    try {
      await runMention(
        provider,
        mentionedRole!,
        project.goal,
        input.data.request,
        persistentCallbacks(projectId, ownerToken, run.id, events),
      );
      await completeRun(projectId, ownerToken, run.id, { status: "completed" });
      events.push(encodeRunEvent("run.completed", { runId: run.id }));

      return sseResponse(events);
    } catch {
      await completeRun(projectId, ownerToken, run.id, {
        status: "failed",
        errorCode: "mention_failed",
      });
      events.push(encodeRunEvent("run.failed", { runId: run.id, error: "运行失败" }));

      return sseResponse(events);
    }
  }

  if (input.data.mode === "iterate") {
    try {
      await updateProjectStatus(projectId, ownerToken, "iterating");
      const step = await runIteration(
        provider,
        project.goal,
        input.data.request,
        currentApp!,
        persistentCallbacks(projectId, ownerToken, run.id, events),
      );
      const app = step.artifact as AppArtifact;
      const version = await createVersion(projectId, ownerToken, {
        title: app.content.title,
        html: app.content.html,
        sourceRunId: run.id,
      });

      await completeRun(projectId, ownerToken, run.id, { status: "completed" });
      await updateProjectStatus(projectId, ownerToken, "ready");
      events.push(encodeRunEvent("run.completed", { runId: run.id, versionId: version.id }));

      return sseResponse(events);
    } catch {
      await completeRun(projectId, ownerToken, run.id, {
        status: "failed",
        errorCode: "iteration_failed",
      });
      await updateProjectStatus(projectId, ownerToken, "failed");
      events.push(encodeRunEvent("run.failed", { runId: run.id, error: "运行失败" }));

      return sseResponse(events);
    }
  }

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
