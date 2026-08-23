import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { POST as login } from "@/app/api/auth/login/route";
import { POST as logout } from "@/app/api/auth/logout/route";
import { GET as me } from "@/app/api/auth/me/route";
import { prisma } from "@/server/prisma";

async function registerUser(email = "user@example.com") {
  return register(new Request("http://localhost/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password: "correct horse battery staple" }),
  }));
}

describe("auth API", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.modelConfig.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("registers a user and sets an HttpOnly session cookie", async () => {
    const response = await registerUser(" USER@Example.COM ");

    expect(response.status).toBe(201);
    expect(response.headers.get("set-cookie")).toContain("agent_studio_session=");
    expect(response.headers.get("set-cookie")).toContain("HttpOnly");
    await expect(response.json()).resolves.toEqual({
      authenticated: true,
      email: "user@example.com",
      onboardingCompleted: false,
      hasModelConfig: false,
    });
  });

  it("does not reveal whether a login email exists", async () => {
    const response = await login(new Request("http://localhost/api/auth/login", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "missing@example.com", password: "wrong password" }),
    }));

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toEqual({ error: "邮箱或密码错误" });
  });

  it("returns the current user from the session and clears it on logout", async () => {
    const registered = await registerUser();
    const cookie = registered.headers.get("set-cookie")?.split(";")[0];
    expect(cookie).toBeTruthy();

    const current = await me(new Request("http://localhost/api/auth/me", {
      headers: { cookie: cookie! },
    }));
    await expect(current.json()).resolves.toMatchObject({ authenticated: true, email: "user@example.com" });

    const loggedOut = await logout(new Request("http://localhost/api/auth/logout", {
      method: "POST",
      headers: { cookie: cookie! },
    }));
    expect(loggedOut.headers.get("set-cookie")).toContain("Max-Age=0");

    const after = await me(new Request("http://localhost/api/auth/me", {
      headers: { cookie: cookie! },
    }));
    await expect(after.json()).resolves.toEqual({ authenticated: false });
  });
});
