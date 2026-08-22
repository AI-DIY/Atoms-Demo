import { NextResponse } from "next/server";
import { restoreVersion } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ projectId: string; versionId: string }>;
};

function notFoundResponse(error: "Project not found" | "Version not found") {
  return NextResponse.json({ error }, { status: 404 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const ownerToken = request.headers.get("x-project-token");

  if (!ownerToken) {
    return notFoundResponse("Project not found");
  }

  const { projectId, versionId } = await params;

  try {
    const restored = await restoreVersion(projectId, ownerToken, versionId);

    return NextResponse.json(restored);
  } catch (error) {
    if (error instanceof Error && error.message === "Project not found") {
      return notFoundResponse("Project not found");
    }

    if (error instanceof Error && error.message === "Version not found") {
      return notFoundResponse("Version not found");
    }

    throw error;
  }
}
