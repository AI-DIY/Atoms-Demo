import type {
  CreatedProject,
  LoadedProject,
  ProjectIdentity,
  ProjectInput,
} from "./client-api";

export const projectIdentityStorageKey = "agent-studio-owner-token";

export type ProjectApi = {
  createProject(input: ProjectInput): Promise<CreatedProject>;
  loadProject(identity: ProjectIdentity): Promise<LoadedProject>;
};

export function readProjectIdentity(storage: Storage): ProjectIdentity | null {
  const rawIdentity = storage.getItem(projectIdentityStorageKey);

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

export async function restoreOrCreateProject({
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
    return api.loadProject(storedIdentity);
  }

  const created = await api.createProject(defaultProject);
  const identity = { projectId: created.id, ownerToken: created.ownerToken };

  storage.setItem(projectIdentityStorageKey, JSON.stringify(identity));

  return api.loadProject(identity);
}
