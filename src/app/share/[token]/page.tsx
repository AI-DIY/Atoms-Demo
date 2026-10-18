import { notFound } from "next/navigation";
import Link from "next/link";
import { prisma } from "@/server/prisma";
import { AppFrame } from "@/components/workspace/AppFrame";

export const dynamic = "force-dynamic";
export const metadata = { title: "共享应用 · Agent Studio", robots: { index: false, follow: false } };

export default async function SharedApp({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const project = await prisma.project.findUnique({ where: { shareToken: token }, select: { id: true, publishedVersion: true } });
  if (!project?.publishedVersion) notFound();
  const app = await prisma.appVersion.findUnique({ where: { projectId_version: { projectId: project.id, version: project.publishedVersion } }, select: { title: true, html: true, version: true } });
  if (!app) notFound();
  return <main className="shared-app">
    <header><Link href="/">A · Agent Studio</Link><strong>{app.title}</strong><span>V{app.version} · 访客数据仅保存在此浏览器</span></header>
    <AppFrame html={app.html} visitorKey={`agent-studio-visitor-${token}`} />
  </main>;
}
