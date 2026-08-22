import { NextResponse } from "next/server";
import { allowProjectCreation } from "@/lib/execution-limits";
import { createProjectInput, maxProjectRequestBytes } from "@/lib/project-input";
import { readBoundedJsonBody } from "@/lib/request-body";
import { createProject } from "@/lib/repository";

export async function POST(request: Request) {
  const requestBody = await readBoundedJsonBody(request, maxProjectRequestBytes);

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

  if (!allowProjectCreation(request)) {
    return NextResponse.json({ error: "请求过于频繁，请稍后重试。" }, { status: 429 });
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
