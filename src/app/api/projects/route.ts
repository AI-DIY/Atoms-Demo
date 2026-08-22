import { NextResponse } from "next/server";
import { z } from "zod";
import { createProject } from "@/lib/repository";

export const createProjectInput = z.object({
  title: z.string().trim().min(1).max(80),
  goal: z.string().trim().min(8).max(2000),
});

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid project input" }, { status: 400 });
  }

  const parsed = createProjectInput.safeParse(body);

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
