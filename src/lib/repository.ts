import { randomUUID } from "node:crypto";
import { prisma } from "@/server/prisma";

type ProjectInput = {
  title: string;
  goal: string;
};

type VersionInput = {
  title: string;
  html: string;
  sourceRunId?: string;
};

type MessageInput = {
  role: string;
  kind: string;
  content: string;
  mention?: string;
};

type RunInput = {
  mode: string;
  status: string;
  planJson?: string;
  errorCode?: string;
};

type RunStepInput = {
  role: string;
  status: string;
  inputSummary: string;
  artifactType?: string;
  artifactJson?: string;
};

type CompleteRunInput = {
  status: string;
  errorCode?: string;
};

const projectIncludes = {
  messages: { orderBy: { createdAt: "asc" as const } },
  runs: {
    orderBy: { startedAt: "desc" as const },
    include: { steps: { orderBy: { id: "asc" as const } } },
  },
  versions: { orderBy: { version: "asc" as const } },
};

async function requireOwnedProject(id: string, ownerToken: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerToken },
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

async function requireOwnedRun(
  projectId: string,
  ownerToken: string,
  runId: string,
) {
  await requireOwnedProject(projectId, ownerToken);

  const run = await prisma.run.findFirst({
    where: { id: runId, projectId },
  });

  if (!run) {
    throw new Error("Run not found");
  }

  return run;
}

export async function createProject(input: ProjectInput) {
  return prisma.project.create({
    data: {
      title: input.title,
      goal: input.goal,
      ownerToken: randomUUID(),
    },
  });
}

export async function getProject(id: string, ownerToken: string) {
  const project = await prisma.project.findFirst({
    where: { id, ownerToken },
    include: projectIncludes,
  });

  if (!project) {
    throw new Error("Project not found");
  }

  return project;
}

export async function appendMessage(
  projectId: string,
  ownerToken: string,
  input: MessageInput,
) {
  await requireOwnedProject(projectId, ownerToken);

  return prisma.message.create({
    data: {
      projectId,
      role: input.role,
      kind: input.kind,
      content: input.content,
      mention: input.mention,
    },
  });
}

export async function createRun(
  projectId: string,
  ownerToken: string,
  input: RunInput,
) {
  await requireOwnedProject(projectId, ownerToken);

  return prisma.run.create({
    data: {
      projectId,
      mode: input.mode,
      status: input.status,
      planJson: input.planJson,
      errorCode: input.errorCode,
    },
  });
}

export async function createRunStep(
  projectId: string,
  ownerToken: string,
  runId: string,
  input: RunStepInput,
) {
  await requireOwnedRun(projectId, ownerToken, runId);

  return prisma.runStep.create({
    data: {
      runId,
      role: input.role,
      status: input.status,
      inputSummary: input.inputSummary,
      artifactType: input.artifactType,
      artifactJson: input.artifactJson,
    },
  });
}

export async function completeRun(
  projectId: string,
  ownerToken: string,
  runId: string,
  input: CompleteRunInput,
) {
  await requireOwnedRun(projectId, ownerToken, runId);

  return prisma.run.update({
    where: { id: runId },
    data: {
      status: input.status,
      errorCode: input.errorCode,
      finishedAt: new Date(),
    },
  });
}

export async function createVersion(
  projectId: string,
  ownerToken: string,
  input: VersionInput,
) {
  await requireOwnedProject(projectId, ownerToken);

  return prisma.$transaction(async (transaction) => {
    const latest = await transaction.appVersion.findFirst({
      where: { projectId },
      orderBy: { version: "desc" },
    });
    const version = (latest?.version ?? 0) + 1;
    const created = await transaction.appVersion.create({
      data: {
        projectId,
        version,
        title: input.title,
        html: input.html,
        sourceRunId: input.sourceRunId,
      },
    });

    await transaction.project.update({
      where: { id: projectId },
      data: { currentVersion: version },
    });

    return created;
  });
}

export async function restoreVersion(
  projectId: string,
  ownerToken: string,
  versionId: string,
) {
  await requireOwnedProject(projectId, ownerToken);

  const version = await prisma.appVersion.findFirst({
    where: { id: versionId, projectId },
  });

  if (!version) {
    throw new Error("Version not found");
  }

  await prisma.project.update({
    where: { id: projectId },
    data: { currentVersion: version.version },
  });

  return version;
}

export function chooseCurrentVersion<T extends { version: number }>(
  versions: T[],
  currentVersion: number,
): T | undefined {
  return versions.find((version) => version.version === currentVersion);
}
