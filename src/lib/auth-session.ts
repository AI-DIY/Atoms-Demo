import { createHash, randomBytes } from "node:crypto";
import type { User } from "@prisma/client";
import { prisma } from "@/server/prisma";
import { findUserById } from "@/lib/user-repository";

export const sessionCookieName = "agent_studio_session";
const sessionLifetimeMs = 30 * 24 * 60 * 60 * 1000;

export class UnauthorizedError extends Error {
  constructor() {
    super("Authentication required");
    this.name = "UnauthorizedError";
  }
}

function hashSessionToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function readCookie(request: Request, name: string): string | null {
  const cookieHeader = request.headers.get("cookie") ?? "";

  for (const part of cookieHeader.split(";")) {
    const [key, ...value] = part.trim().split("=");

    if (key === name) {
      return decodeURIComponent(value.join("="));
    }
  }

  return null;
}

export async function createSession(userId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionLifetimeMs);

  await prisma.session.create({
    data: {
      tokenHash: hashSessionToken(token),
      userId,
      expiresAt,
    },
  });

  return { token, expiresAt };
}

export async function getCurrentUser(request: Request): Promise<User | null> {
  const token = readCookie(request, sessionCookieName);

  if (!token) {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashSessionToken(token) },
  });

  if (!session) {
    return null;
  }

  if (session.expiresAt.getTime() <= Date.now()) {
    await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }

  return findUserById(session.userId);
}

export async function requireCurrentUser(request: Request): Promise<User> {
  const user = await getCurrentUser(request);

  if (!user) {
    throw new UnauthorizedError();
  }

  return user;
}

export async function deleteSession(request: Request): Promise<void> {
  const token = readCookie(request, sessionCookieName);

  if (!token) {
    return;
  }

  await prisma.session.deleteMany({ where: { tokenHash: hashSessionToken(token) } });
}

export function setSessionCookie(
  response: Response,
  token: string,
  expiresAt: Date,
  request: Request,
) {
  const cookieValue = `${sessionCookieName}=${encodeURIComponent(token)}; Path=/; HttpOnly; SameSite=Lax; Expires=${expiresAt.toUTCString()}${isSecureRequest(request) ? "; Secure" : ""}`;
  response.headers.append("Set-Cookie", cookieValue);
}

function isSecureRequest(request: Request): boolean {
  const forwardedProtocol = request.headers.get("x-forwarded-proto")
    ?.split(",", 1)[0]
    ?.trim()
    .toLowerCase();

  if (forwardedProtocol) return forwardedProtocol === "https";

  return new URL(request.url).protocol === "https:";
}

export function clearSessionCookie(response: Response, request: Request) {
  response.headers.append(
    "Set-Cookie",
    `${sessionCookieName}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${isSecureRequest(request) ? "; Secure" : ""}`,
  );
}
