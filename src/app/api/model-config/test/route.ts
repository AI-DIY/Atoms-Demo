import OpenAI from "openai";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { modelConfigInput } from "@/lib/model-config";
import { readJsonBody } from "@/lib/request-json";

export async function POST(request: Request) {
  if (!(await getCurrentUser(request))) {
    return NextResponse.json({ error: "请先登录" }, { status: 401 });
  }

  const parsed = modelConfigInput.safeParse(await readJsonBody(request));
  if (!parsed.success || parsed.data.apiKey.length === 0) {
    return NextResponse.json({ error: "请完整填写模型配置和 API Key" }, { status: 400 });
  }

  if (process.env.MOCK_LLM === "true") {
    return NextResponse.json({ ok: true });
  }

  try {
    const client = new OpenAI({ baseURL: parsed.data.baseUrl, apiKey: parsed.data.apiKey });
    await client.responses.create({ model: parsed.data.modelId, input: "ping" });
    return NextResponse.json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message.split(parsed.data.apiKey).join("[REDACTED]") : "连接模型服务失败";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
