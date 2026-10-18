import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { getProject, getProjectForUser } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
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
    const { ownerToken: _ownerToken, ...publicProject } = project as typeof project & {
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
