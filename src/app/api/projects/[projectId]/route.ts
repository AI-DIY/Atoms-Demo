import { NextResponse } from "next/server";
import { getProject } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ projectId: string }>;
};

function notFoundResponse() {
  return NextResponse.json({ error: "Project not found" }, { status: 404 });
}

export async function GET(request: Request, { params }: RouteContext) {
  const ownerToken = request.headers.get("x-project-token");

  if (!ownerToken) {
    return notFoundResponse();
  }

  const { projectId } = await params;

  try {
    const project = await getProject(projectId, ownerToken);
    const { ownerToken: _ownerToken, ...publicProject } = project as typeof project & {
      ownerToken?: string;
    };

    return NextResponse.json(publicProject);
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return notFoundResponse();
    }

    throw error;
  }
}
