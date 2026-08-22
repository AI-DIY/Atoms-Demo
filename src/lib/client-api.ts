export type ProjectInput = {
  title: string;
  goal: string;
};

export type ProjectIdentity = {
  projectId: string;
  ownerToken: string;
};

export type ProjectVersion = {
  id: string;
  version: number;
  title: string;
  html: string;
};

export type ProjectRun = {
  id: string;
  mode: string;
  status: string;
  planJson?: string | null;
  startedAt?: string;
  steps?: Array<{ role: string; status: string }>;
};

export type ProjectMessage = {
  id: string;
  role: string;
  kind: string;
  content: string;
  mention?: string | null;
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
  messages?: ProjectMessage[];
  runs?: ProjectRun[];
  versions?: ProjectVersion[];
};

export type RestoreVersionResult = {
  version: ProjectVersion;
  project: LoadedProject;
};

export type Fetcher = (
  input: RequestInfo | URL,
  init?: RequestInit,
) => Promise<Response>;

export type RunEventHandler = (name: string, data: unknown) => void;

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

function errorMessageFromResponseBody(detail: string): string {
  try {
    const body: unknown = JSON.parse(detail);

    if (body && typeof body === "object" && !Array.isArray(body)) {
      const error = Reflect.get(body, "error");
      const message = Reflect.get(body, "message");

      if (typeof error === "string") return error;
      if (error && typeof error === "object" && typeof Reflect.get(error, "message") === "string") {
        return Reflect.get(error, "message") as string;
      }
      if (typeof message === "string") return message;
    }
  } catch {
    // Non-JSON API errors retain their response text.
  }

  return detail;
}

async function readErrorMessage(response: Response): Promise<string> {
  const detail = errorMessageFromResponseBody(await response.text());
  return detail || `Request failed with status ${response.status}`;
}

async function readJson<T>(response: Response): Promise<T> {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
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

export async function restoreVersion(
  projectId: string,
  ownerToken: string,
  versionId: string,
  fetcher: Fetcher = fetch,
): Promise<RestoreVersionResult> {
  const response = await fetcher(
    `/api/projects/${projectId}/versions/${versionId}/restore`,
    { method: "POST", headers: { "x-project-token": ownerToken } },
  );

  return readJson<RestoreVersionResult>(response);
}

function emitSseEvent(block: string, onEvent: RunEventHandler) {
  let name: string | null = null;
  const dataLines: string[] = [];

  for (const line of block.split("\n")) {
    if (line.startsWith("event:")) {
      name = line.slice("event:".length).trim();
    }

    if (line.startsWith("data:")) {
      dataLines.push(line.slice("data:".length).trimStart());
    }
  }

  if (name && dataLines.length > 0) {
    onEvent(name, JSON.parse(dataLines.join("\n")));
  }
}

async function consumeSse(response: Response, onEvent: RunEventHandler): Promise<void> {
  if (!response.ok) {
    throw new ApiError(response.status, await readErrorMessage(response));
  }

  if (!response.body) {
    throw new Error("运行响应不包含事件流");
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    buffer = buffer.replace(/\r\n/g, "\n");

    let boundary = buffer.indexOf("\n\n");
    while (boundary >= 0) {
      emitSseEvent(buffer.slice(0, boundary), onEvent);
      buffer = buffer.slice(boundary + 2);
      boundary = buffer.indexOf("\n\n");
    }
  }

  buffer += decoder.decode();
  buffer = buffer.replace(/\r\n/g, "\n");
  if (buffer.length > 0) emitSseEvent(buffer, onEvent);
}

export async function startRun(
  projectId: string,
  ownerToken: string,
  body: unknown,
  onEvent: RunEventHandler,
): Promise<void> {
  const response = await fetch(`/api/projects/${projectId}/runs`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-project-token": ownerToken,
    },
    body: JSON.stringify(body),
  });

  return consumeSse(response, onEvent);
}

export async function approveRun(
  projectId: string,
  ownerToken: string,
  runId: string,
  onEvent: RunEventHandler,
): Promise<void> {
  const response = await fetch(
    "/api/projects/" + projectId + "/runs/" + runId + "/approve",
    {
      method: "POST",
      headers: { "x-project-token": ownerToken },
    },
  );

  return consumeSse(response, onEvent);
}
