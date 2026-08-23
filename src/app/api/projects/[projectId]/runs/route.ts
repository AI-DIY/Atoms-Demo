import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-session";
import type { AppArtifact, ParsedArtifact } from "@/lib/artifacts";
import {
  allowModelStart,
  specialistGenerationGate,
  teamGenerationGate,
} from "@/lib/execution-limits";
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
  createRunWithMessage,
  createRunStep,
  createVersion,
  getProject,
  updateProjectStatus,
  updateRun,
  getProjectForUser,
} from "@/lib/repository";
import { getModelConfig, } from "@/lib/user-repository";
import { modelConfigForProvider } from "@/lib/model-config";
import { readBoundedJsonBody } from "@/lib/request-body";
import { maxRunRequestBytes } from "@/lib/run-input";
import { streamRunEvents, type RunEventEmitter } from "@/lib/run-events";

const runRequest = z.string().trim().min(1).max(2_000);
const createRunInput = z.discriminatedUnion("mode", [
  z.object({ mode: z.literal("team"), request: runRequest }).strict(),
  z.object({ mode: z.literal("mention"), request: runRequest }).strict(),
  z.object({ mode: z.literal("iterate"), request: runRequest }).strict(),
]);

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Run failed";
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
  emit: RunEventEmitter,
): PersistentCallbacks {
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

  const requestBody = await readBoundedJsonBody(request, maxRunRequestBytes);

  if (requestBody.kind === "tooLarge") {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const input = createRunInput.safeParse(
    requestBody.kind === "json" ? requestBody.body : undefined,
  );

  if (!input.success) {
    return NextResponse.json({ error: "Invalid run input" }, { status: 400 });
  }

  const { projectId } = await params;

  let project;
  let effectiveOwnerToken = ownerToken;
  const user = await getCurrentUser(request);

  try {
    if (user) {
      const owned = await getProjectForUser(projectId, user.id);
      project = owned;
      effectiveOwnerToken = owned.ownerToken;
    } else if (ownerToken) {
      project = await getProject(projectId, ownerToken);
    } else {
      return notFoundResponse();
    }
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
    const config = user ? await getModelConfig(user.id) : null;
    if (user && !config) {
      return NextResponse.json({ error: "请先完成模型配置" }, { status: 503 });
    }
    provider = getAgentProvider(process.env, undefined, config ? await modelConfigForProvider(config) : undefined);
  } catch (error) {
    return NextResponse.json({ error: errorMessage(error) }, { status: 503 });
  }

  if (!allowModelStart(request)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后重试。" }, { status: 429 });
  }

  const gate = input.data.mode === "team" ? teamGenerationGate : specialistGenerationGate;
  let release: () => void;

  try {
    release = await gate.acquire();
  } catch {
    return NextResponse.json({ error: "服务器正忙，请稍后重试。" }, { status: 503 });
  }

  let run;

  try {
    run = await createRunWithMessage(
      projectId,
      effectiveOwnerToken!,
      {
        mode: input.data.mode,
        status: input.data.mode === "team" ? "planning" : "running",
      },
      {
        role: "user",
        kind: "user",
        content: input.data.request,
        mention: mentionedRole ?? undefined,
      },
    );
  } catch (error) {
    release();
    throw error;
  }

  return streamRunEvents(run.id, async (emit) => {
    try {
      emit("run.started", { runId: run.id, mode: run.mode });

      if (input.data.mode === "mention") {
        try {
          await runMention(
            provider,
            mentionedRole!,
            project.goal,
            input.data.request,
            persistentCallbacks(projectId, effectiveOwnerToken!, run.id, emit),
          );
          await completeRun(projectId, effectiveOwnerToken!, run.id, { status: "completed" });
          emit("run.completed", { runId: run.id });
        } catch {
          await completeRun(projectId, effectiveOwnerToken!, run.id, {
            status: "failed",
            errorCode: "mention_failed",
          });
          emit("run.failed", { runId: run.id, error: "运行失败" });
        }

        return;
      }

      if (input.data.mode === "iterate") {
        try {
          await updateProjectStatus(projectId, effectiveOwnerToken!, "iterating");
          const step = await runIteration(
            provider,
            project.goal,
            input.data.request,
            currentApp!,
            persistentCallbacks(projectId, effectiveOwnerToken!, run.id, emit),
          );
          const app = step.artifact as AppArtifact;
          const version = await createVersion(projectId, effectiveOwnerToken!, {
            title: app.content.title,
            html: app.content.html,
            sourceRunId: run.id,
          });

          await completeRun(projectId, effectiveOwnerToken!, run.id, { status: "completed" });
          await updateProjectStatus(projectId, effectiveOwnerToken!, "ready");
          emit("run.completed", { runId: run.id, versionId: version.id });
        } catch {
          await completeRun(projectId, effectiveOwnerToken!, run.id, {
            status: "failed",
            errorCode: "iteration_failed",
          });
          await updateProjectStatus(projectId, effectiveOwnerToken!, "failed");
          emit("run.failed", { runId: run.id, error: "运行失败" });
        }

        return;
      }

      try {
        const plan = await createTeamPlan(
          provider,
          input.data.request,
            persistentCallbacks(projectId, effectiveOwnerToken!, run.id, emit),
        );

        await updateRun(projectId, effectiveOwnerToken!, run.id, {
          status: "awaiting_approval",
          planJson: JSON.stringify({ goal: plan.goal, artifact: plan.artifact }),
        });
        await updateProjectStatus(projectId, effectiveOwnerToken!, "awaiting_approval");
        emit("run.awaiting_approval", { runId: run.id });
      } catch (error) {
        await completeRun(projectId, effectiveOwnerToken!, run.id, {
          status: "failed",
          errorCode: "plan_failed",
        });
        await updateProjectStatus(projectId, effectiveOwnerToken!, "failed");
        emit("run.failed", { runId: run.id, error: errorMessage(error) });
      }
    } finally {
      release();
    }
  });
}
