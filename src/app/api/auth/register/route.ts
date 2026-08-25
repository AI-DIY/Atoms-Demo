import { NextResponse } from "next/server";
import { z } from "zod";
import { hashPassword, normalizeEmail } from "@/lib/auth";
import { createSession, setSessionCookie } from "@/lib/auth-session";
import { readJsonBody } from "@/lib/request-json";
import { createUser, findUserByEmail } from "@/lib/user-repository";

const registerInput = z.object({
  email: z.string().trim().email().transform(normalizeEmail),
  password: z.string().min(8).max(200),
}).strict();

export async function POST(request: Request) {
  const parsed = registerInput.safeParse(await readJsonBody(request));

  if (!parsed.success) {
    return NextResponse.json({ error: "请输入有效的邮箱和至少 8 位密码" }, { status: 400 });
  }

  if (await findUserByEmail(parsed.data.email)) {
    return NextResponse.json({ error: "该邮箱已注册" }, { status: 409 });
  }

  const user = await createUser({
    email: parsed.data.email,
    passwordHash: await hashPassword(parsed.data.password),
  });
  const session = await createSession(user.id);
  const response = NextResponse.json({
    authenticated: true,
    email: user.email,
  }, { status: 201 });

  setSessionCookie(response, session.token, session.expiresAt, request);
  return response;
}
