import { NextResponse } from "next/server";
import { z } from "zod";
import { normalizeEmail, verifyPassword } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/auth-session";
import { readJsonBody } from "@/lib/request-json";
import { findUserByEmail, getModelConfig } from "@/lib/user-repository";

const loginInput = z.object({
  email: z.string().trim().email().transform(normalizeEmail),
  password: z.string().min(1).max(200),
}).strict();

export async function POST(request: Request) {
  const parsed = loginInput.safeParse(await readJsonBody(request));
  const invalid = () => NextResponse.json({ error: "邮箱或密码错误" }, { status: 401 });

  if (!parsed.success) {
    return invalid();
  }

  const user = await findUserByEmail(parsed.data.email);

  if (!user || !(await verifyPassword(parsed.data.password, user.passwordHash))) {
    return invalid();
  }

  const session = await createSession(user.id);
  const response = NextResponse.json({
    authenticated: true,
    email: user.email,
    onboardingCompleted: user.onboardingCompleted,
    hasModelConfig: Boolean(await getModelConfig(user.id)),
  });

  setSessionCookie(response, session.token, session.expiresAt);
  return response;
}
