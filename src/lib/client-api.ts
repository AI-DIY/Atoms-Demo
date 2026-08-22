export type ProjectInput = {
  title: string;
  goal: string;
};

export type ProjectIdentity = {
  projectId: string;
  ownerToken: string;
};

export type CreatedProject = ProjectInput & {
  id: string;
  ownerToken: string;
  status: string;
};

export type LoadedProject = ProjectInput & {
  id: string;
  status: string;
  currentVersion: number;
};

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const detail = await response.text();
    throw new ApiError(
      response.status,
      detail || `Request failed with status ${response.status}`,
    );
  }

  return response.json() as Promise<T>;
}

export async function createProject(
  input: ProjectInput,
  fetcher: Fetcher = fetch,
): Promise<CreatedProject> {
  const response = await fetcher("/api/projects", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(input),
  });

  return readJson<CreatedProject>(response);
}

export async function loadProject(
  identity: ProjectIdentity,
  fetcher: Fetcher = fetch,
): Promise<LoadedProject> {
  const response = await fetcher(`/api/projects/${identity.projectId}`, {
    headers: { "x-project-token": identity.ownerToken },
  });

  return readJson<LoadedProject>(response);
}
