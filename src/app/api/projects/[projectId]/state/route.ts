import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { isAppState, maxAppStateBytes } from "@/lib/app-state";
import { readBoundedJsonBody } from "@/lib/request-body";
import { prisma } from "@/server/prisma";

type Context = { params: Promise<{ projectId: string }> };

export async function GET(request: Request, { params }: Context) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const { projectId } = await params;
  const project = await prisma.project.findFirst({ where: { id: projectId, userId: user.id }, select: { appStateJson: true } });
  if (!project) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json(JSON.parse(project.appStateJson), { headers: { "Cache-Control": "no-store" } });
}

export async function PUT(request: Request, { params }: Context) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const input = await readBoundedJsonBody(request, maxAppStateBytes);
  if (input.kind === "tooLarge") return NextResponse.json({ error: "应用数据超过 64 KB" }, { status: 413 });
  if (input.kind !== "json" || !isAppState(input.body)) return NextResponse.json({ error: "应用数据格式无效" }, { status: 400 });
  const { projectId } = await params;
  const result = await prisma.project.updateMany({
    where: { id: projectId, userId: user.id }, data: { appStateJson: JSON.stringify(input.body) },
  });
  if (!result.count) return NextResponse.json({ error: "项目不存在" }, { status: 404 });
  return NextResponse.json({ saved: true });
}
