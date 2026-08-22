import { NextResponse } from "next/server";
import { createProjectInput, maxProjectRequestBytes } from "@/lib/project-input";
import { createProject } from "@/lib/repository";

type RequestBodyResult =
  | { kind: "invalid" }
  | { kind: "tooLarge" }
  | { kind: "json"; body: unknown };

async function readProjectRequestBody(request: Request): Promise<RequestBodyResult> {
  const reader = request.body?.getReader();

  if (!reader) {
    return { kind: "invalid" };
  }

  const chunks: Uint8Array[] = [];
  let byteLength = 0;

  try {
    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      byteLength += value.byteLength;

      if (byteLength > maxProjectRequestBytes) {
        await reader.cancel();
        return { kind: "tooLarge" };
      }

      chunks.push(value);
    }
  } catch {
    return { kind: "invalid" };
  }

  const bytes = new Uint8Array(byteLength);
  let offset = 0;

  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return { kind: "json", body: JSON.parse(new TextDecoder().decode(bytes)) };
  } catch {
    return { kind: "invalid" };
  }
}

export async function POST(request: Request) {
  const contentLength = Number(request.headers.get("content-length"));

  if (Number.isFinite(contentLength) && contentLength > maxProjectRequestBytes) {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  const requestBody = await readProjectRequestBody(request);

  if (requestBody.kind === "tooLarge") {
    return NextResponse.json({ error: "Request body too large" }, { status: 413 });
  }

  if (requestBody.kind === "invalid") {
    return NextResponse.json({ error: "Invalid project input" }, { status: 400 });
  }

  const parsed = createProjectInput.safeParse(requestBody.body);

  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid project input" }, { status: 400 });
  }

  const project = await createProject(parsed.data);

  return NextResponse.json(
    {
      id: project.id,
      ownerToken: project.ownerToken,
      title: project.title,
      goal: project.goal,
      status: project.status,
    },
    { status: 201 },
  );
}
