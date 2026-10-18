import {
  ApiError,
  type CreatedProject,
  type LoadedProject,
  type ProjectIdentity,
  type ProjectInput,
  type ProjectSummary,
} from "./client-api";

export const projectIdentityStorageKey = "agent-studio-owner-token";

const inFlightProjectRestores = new WeakMap<
  Storage,
  Map<string, Promise<LoadedProject>>
>();

export type ProjectApi = {
  listProjects?(): Promise<ProjectSummary[]>;
  createProject(input: ProjectInput): Promise<CreatedProject>;
  loadProject(identity: ProjectIdentity): Promise<LoadedProject>;
};

function safelyRead(storage: Storage, key: string): string | null {
  try {
    return storage.getItem(key);
  } catch {
    return null;
  }
}

function safelyWrite(storage: Storage, key: string, value: string) {
  try {
    storage.setItem(key, value);
  } catch {
    // A blocked browser storage area should not prevent a temporary session.
  }
}

function safelyRemove(storage: Storage, key: string) {
  try {
    storage.removeItem(key);
  } catch {
    // The recovery request can still create a usable in-memory project session.
  }
}

function getInFlightRestores(storage: Storage) {
  let restores = inFlightProjectRestores.get(storage);

  if (!restores) {
    restores = new Map();
    inFlightProjectRestores.set(storage, restores);
  }

  return restores;
}

export function readProjectIdentity(storage: Storage): ProjectIdentity | null {
  const rawIdentity = safelyRead(storage, projectIdentityStorageKey);

  if (!rawIdentity) {
    return null;
  }

  try {
    const identity = JSON.parse(rawIdentity) as Record<string, unknown>;

    if (
      typeof identity.projectId === "string" &&
      identity.projectId.length > 0 &&
      typeof identity.ownerToken === "string" &&
      identity.ownerToken.length > 0
    ) {
      return { projectId: identity.projectId, ownerToken: identity.ownerToken };
    }
  } catch {
    // Treat a malformed browser value as absent and replace it with a new identity.
  }

  return null;
}

async function createAndLoadProject(
  storage: Storage,
  api: ProjectApi,
  defaultProject: ProjectInput,
) {
  const created = await api.createProject(defaultProject);
  const identity = { projectId: created.id, ownerToken: created.ownerToken };

  safelyWrite(storage, projectIdentityStorageKey, JSON.stringify(identity));

  return api.loadProject(identity);
}

async function restoreOrCreateProjectInternal({
  storage,
  api,
  defaultProject,
}: {
  storage: Storage;
  api: ProjectApi;
  defaultProject: ProjectInput;
}): Promise<LoadedProject> {
  const storedIdentity = readProjectIdentity(storage);

  if (storedIdentity) {
    try {
      return await api.loadProject(storedIdentity);
    } catch (error) {
      if (error instanceof ApiError && error.status === 404) {
        safelyRemove(storage, projectIdentityStorageKey);
      } else {
        throw error;
      }
    }
  }

  const projects = api.listProjects ? await api.listProjects() : undefined;
  if (projects?.length) {
    const identity = { projectId: projects[0].id, ownerToken: "session" };
    safelyWrite(storage, projectIdentityStorageKey, JSON.stringify(identity));
    return api.loadProject(identity);
  }
  return createAndLoadProject(storage, api, defaultProject);
}

export function restoreOrCreateProject({
  storage,
  api,
  defaultProject,
}: {
  storage: Storage;
  api: ProjectApi;
  defaultProject: ProjectInput;
}): Promise<LoadedProject> {
  const restores = getInFlightRestores(storage);
  const existing = restores.get(projectIdentityStorageKey);

  if (existing) {
    return existing;
  }

  const restoring = restoreOrCreateProjectInternal({ storage, api, defaultProject });
  const settled = restoring.finally(() => {
    if (restores.get(projectIdentityStorageKey) === settled) {
      restores.delete(projectIdentityStorageKey);
      if (restores.size === 0) {
        inFlightProjectRestores.delete(storage);
      }
    }
  });

  restores.set(projectIdentityStorageKey, settled);

  return settled;
}
