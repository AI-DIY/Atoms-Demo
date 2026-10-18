import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { getProject, getProjectForUser } from "@/lib/repository";
import { prisma } from "@/server/prisma";
import { readBoundedJsonBody } from "@/lib/request-body";
import { z } from "zod";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}

export async function PATCH(request: Request, { params }: RouteContext) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await readBoundedJsonBody(request, 2048);
  if (body.kind !== "json")
    return NextResponse.json(
      { error: "项目名称无效" },
      { status: body.kind === "tooLarge" ? 413 : 400 },
    );
  const input = z
    .object({ title: z.string().trim().min(1).max(80) })
    .strict()
    .safeParse(body.body);
  if (!input.success)
    return NextResponse.json(
      { error: "项目名称应为 1–80 个字符" },
      { status: 400 },
    );
  const { projectId } = await params;
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId: user.id },
    data: input.data,
  });
  if (!result.count) return notFoundResponse();
  return NextResponse.json(
    await prisma.project.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        title: true,
        goal: true,
        status: true,
        currentVersion: true,
        updatedAt: true,
      },
    }),
  );
}

export async function GET(request: Request, { params }: RouteContext) {
  const ownerToken = request.headers.get("x-project-token");

  const { projectId } = await params;

  try {
    const user = await getCurrentUser(request);
    const project = user
      ? await getProjectForUser(projectId, user.id)
      : ownerToken
        ? await getProject(projectId, ownerToken)
        : null;
    if (!project) return notFoundResponse();
    const { ownerToken: _ownerToken, ...publicProject } =
      project as typeof project & {
        ownerToken?: string;
      };
    void _ownerToken;

    return NextResponse.json(publicProject);
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return notFoundResponse();
    }

    throw error;
  }
}
