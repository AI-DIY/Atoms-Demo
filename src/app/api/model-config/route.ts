import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { encryptedApiKey, modelConfigInput, modelConfigView } from "@/lib/model-config";
import { readJsonBody } from "@/lib/request-json";
import { getModelConfig, upsertModelConfig } from "@/lib/user-repository";

function unauthorized() {
  return NextResponse.json({ error: "请先登录" }, { status: 401 });
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) return unauthorized();

  const config = await getModelConfig(user.id);
  return NextResponse.json(config ? await modelConfigView(config) : null);
}

export async function PUT(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return unauthorized();

  const parsed = modelConfigInput.safeParse(await readJsonBody(request));
  if (!parsed.success) {
    return NextResponse.json({ error: "请完整填写模型配置和 API Key" }, { status: 400 });
  }

  try {
    const existing = await getModelConfig(user.id);
    if (parsed.data.apiKey.length === 0 && !existing) {
      return NextResponse.json({ error: "请完整填写模型配置和 API Key" }, { status: 400 });
    }
    const config = await upsertModelConfig({
      userId: user.id,
      ...parsed.data,
      apiKeyCiphertext: parsed.data.apiKey.length > 0
        ? await encryptedApiKey(parsed.data.apiKey)
        : existing!.apiKeyCiphertext,
    });
    return NextResponse.json(await modelConfigView(config));
  } catch (error) {
    throw error;
  }
}
