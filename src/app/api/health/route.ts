import { NextResponse } from "next/server";
import { prisma } from "@/server/prisma";

export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    const mode = process.env.MOCK_LLM === "true" ? "demo" : "live";
    const configured = mode === "demo" || Boolean(process.env.RESPONSES_API_BASE_URL && process.env.RESPONSES_API_KEY && process.env.RESPONSES_MODEL);
    return NextResponse.json({ status: configured ? "ok" : "unconfigured", version: "2.0.0", mode }, { status: configured ? 200 : 503, headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ status: "unavailable", version: "2.0.0" }, { status: 503 });
  }
}
