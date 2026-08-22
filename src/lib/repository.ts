import { randomUUID } from "node:crypto";
import type { ProjectStatus } from "@/lib/domain";
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

type UpdateRunInput = {
  status?: string;
  planJson?: string;
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

const projectSelect = {
  id: true,
  title: true,
  goal: true,
  status: true,
  currentVersion: true,
  createdAt: true,
  updatedAt: true,
  ...projectIncludes,
};

const versionLocks = new Map<string, Promise<void>>();

async function withProjectVersionLock<T>(
  projectId: string,
  action: () => Promise<T>,
): Promise<T> {
  const previous = versionLocks.get(projectId) ?? Promise.resolve();
  let releaseCurrent!: () => void;
  const current = new Promise<void>((resolve) => {
    releaseCurrent = resolve;
  });

  versionLocks.set(projectId, current);
  await previous;

  try {
    return await action();
  } finally {
    releaseCurrent();
    if (versionLocks.get(projectId) === current) {
      versionLocks.delete(projectId);
    }
  }
}

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
    select: projectSelect,
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

export async function updateProjectStatus(
  projectId: string,
  ownerToken: string,
  status: ProjectStatus,
) {
  await requireOwnedProject(projectId, ownerToken);

  return prisma.project.update({
    where: { id: projectId },
    data: { status },
    select: projectSelect,
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

export async function getRun(projectId: string, ownerToken: string, runId: string) {
  await requireOwnedProject(projectId, ownerToken);

  const run = await prisma.run.findFirst({
    where: { id: runId, projectId },
    include: { steps: { orderBy: { id: "asc" } } },
  });

  if (!run) {
    throw new Error("Run not found");
  }

  return run;
}

export async function updateRun(
  projectId: string,
  ownerToken: string,
  runId: string,
  input: UpdateRunInput,
) {
  await requireOwnedRun(projectId, ownerToken, runId);

  return prisma.run.update({
    where: { id: runId },
    data: input,
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
  return withProjectVersionLock(projectId, async () => {
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
  });
}

export async function restoreVersion(
  projectId: string,
  ownerToken: string,
  versionId: string,
) {
  return withProjectVersionLock(projectId, async () => {
    await requireOwnedProject(projectId, ownerToken);

    return prisma.$transaction(async (transaction) => {
      const version = await transaction.appVersion.findFirst({
        where: { id: versionId, projectId },
      });

      if (!version) {
        throw new Error("Version not found");
      }

      await transaction.project.update({
        where: { id: projectId },
        data: { currentVersion: version.version },
      });
      await transaction.message.create({
        data: {
          projectId,
          role: "system",
          kind: "system",
          content: `Restored version V${version.version}`,
        },
      });

      return version;
    });
  });
}

export function chooseCurrentVersion<T extends { version: number }>(
  versions: T[],
  currentVersion: number,
): T {
  const version = versions.find((item) => item.version === currentVersion);

  if (!version) {
    throw new Error("Version not found");
  }

  return version;
}
