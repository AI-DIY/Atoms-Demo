import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth-session";
import { getModelConfig } from "@/lib/user-repository";
import { markOnboardingCompleted } from "@/lib/user-repository";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);

  if (!user) {
    return NextResponse.json({ authenticated: false });
  }

  return NextResponse.json({
    authenticated: true,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    hasModelConfig: Boolean(await getModelConfig(user.id)),
  });
}

export async function PATCH(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "请先登录" }, { status: 401 });
  const updated = await markOnboardingCompleted(user.id);
  return NextResponse.json({
    authenticated: true,
    email: updated.email,
    onboardingCompleted: true,
    hasModelConfig: Boolean(await getModelConfig(updated.id)),
  });
}
