import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { prisma } from "@/server/prisma";

type Context = { params: Promise<{ projectId: string }> };

export async function POST(request: Request, { params }: Context) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  if (project.status !== "ready" || !project.currentVersion) {
    return NextResponse.json({ error: "请等待应用生成完成后发布" }, { status: 409 });
  }
  const published = await prisma.project.update({
    where: { id: projectId },
    data: { shareToken: project.shareToken ?? randomBytes(18).toString("base64url"), publishedVersion: project.currentVersion, publishedAt: new Date() },
    select: { shareToken: true, publishedVersion: true },
  });
  return NextResponse.json(published);
}

export async function DELETE(request: Request, { params }: Context) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId: user.id }, data: { shareToken: null, publishedVersion: null, publishedAt: null },
  });
  if (!result.count) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ shareToken: null, publishedVersion: null });
}
