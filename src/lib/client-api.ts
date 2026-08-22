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
  status: string;
  steps?: Array<{ role: string; status: string }>;
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
  runs?: ProjectRun[];
  versions?: ProjectVersion[];
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
    const detail = await response.text();
    throw new ApiError(
      response.status,
      detail || `Request failed with status ${response.status}`,
    );
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
