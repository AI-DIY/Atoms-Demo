import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth-session";
import { parseArtifact } from "@/lib/artifacts";
import { teamGenerationGate } from "@/lib/execution-limits";
import { readBoundedJsonBody } from "@/lib/request-body";
import { createVersion, updateProjectStatus } from "@/lib/repository";
import { prisma } from "@/server/prisma";

export async function POST(
  request: Request,
  { params }: { params: Promise<{ projectId: string }> },
) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const body = await readBoundedJsonBody(request, 128_000);
  if (body.kind !== "json")
    return NextResponse.json(
      { error: "源码请求无效或过大" },
      { status: body.kind === "tooLarge" ? 413 : 400 },
    );
  const input = z
    .object({
      html: z.string().min(80).max(50_000),
      baseVersion: z.number().int().positive(),
    })
    .strict()
    .safeParse(body.body);
  if (!input.success)
    return NextResponse.json(
      { error: "请提交完整的 HTML（上限 50 KB）和当前版本" },
      { status: 400 },
    );
  const { projectId } = await params;
  const project = await prisma.project.findFirst({
    where: { id: projectId, userId: user.id },
  });
  if (!project)
    return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  let release: (() => void) | undefined;
  try {
    release = await teamGenerationGate.acquire();
  } catch {
    return NextResponse.json(
      { error: "团队正在构建，请稍后保存" },
      { status: 409 },
    );
  }
  try {
    const latest = await prisma.project.findUniqueOrThrow({
      where: { id: projectId },
    });
    if (
      latest.status !== "ready" ||
      latest.currentVersion !== input.data.baseVersion
    ) {
      return NextResponse.json(
        { error: "项目正在运行或版本已变更，请刷新后再编辑" },
        { status: 409 },
      );
    }
    let app;
    try {
      app = parseArtifact("app", {
        title: `${project.title.slice(0, 70)} · 源码编辑`,
        html: input.data.html,
      });
    } catch {
      return NextResponse.json(
        { error: "HTML 无效或超过 50 KB，请检查源码" },
        { status: 400 },
      );
    }
    const version = await createVersion(projectId, project.ownerToken, {
      ...app.content,
      expectedVersion: input.data.baseVersion,
    });
    await updateProjectStatus(projectId, project.ownerToken, "ready");
    return NextResponse.json(version, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message === "Version conflict")
      return NextResponse.json(
        { error: "版本已变更，请刷新后再编辑" },
        { status: 409 },
      );
    throw error;
  } finally {
    release();
  }
}
