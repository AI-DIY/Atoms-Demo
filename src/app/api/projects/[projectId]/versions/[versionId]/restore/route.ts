import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { getProjectForUser, restoreVersion } from "@/lib/repository";

type RouteContext = {
  params: Promise<{ projectId: string; versionId: string }>;
};

function notFoundResponse(error: "Project not found" | "Version not found") {
  return NextResponse.json({ error }, { status: 404 });
}

export async function POST(request: Request, { params }: RouteContext) {
  const ownerToken = request.headers.get("x-project-token");

  const { projectId, versionId } = await params;

  try {
    const user = await getCurrentUser(request);
    const effectiveOwnerToken = user
      ? (await getProjectForUser(projectId, user.id)).ownerToken
      : ownerToken;
    if (!effectiveOwnerToken) return notFoundResponse("Project not found");
    const restored = await restoreVersion(projectId, effectiveOwnerToken, versionId);

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
