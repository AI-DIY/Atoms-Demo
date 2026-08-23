import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { POST as register } from "@/app/api/auth/register/route";
import { GET, PUT } from "@/app/api/model-config/route";
import { prisma } from "@/server/prisma";

describe("model config API", () => {
  beforeEach(async () => {
    await prisma.session.deleteMany();
    await prisma.modelConfig.deleteMany();
    await prisma.user.deleteMany();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("stores configuration and only returns a masked API key", async () => {
    const registered = await register(new Request("http://localhost/api/auth/register", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ email: "model@example.com", password: "correct horse battery staple" }),
    }));
    const cookie = registered.headers.get("set-cookie")!.split(";")[0];
    const input = {
      baseUrl: "https://api.openai.com/v1",
      apiKey: "sk-secret-key-1234",
      modelId: "gpt-5.5",
      displayName: "工作模型",
      notes: "默认",
      maxOutputTokens: 2048,
      reasoningEffort: "medium",
    };

    const saved = await PUT(new Request("http://localhost/api/model-config", {
      method: "PUT",
      headers: { cookie, "content-type": "application/json" },
      body: JSON.stringify(input),
    }));
    const body = await saved.json();

    expect(saved.status).toBe(200);
    expect(body).toMatchObject({ modelId: "gpt-5.5", apiKeyMasked: "sk-s••••1234" });
    expect(body).not.toHaveProperty("apiKey");

    const stored = await prisma.modelConfig.findFirst();
    expect(stored?.apiKeyCiphertext).not.toContain(input.apiKey);

    const loaded = await GET(new Request("http://localhost/api/model-config", { headers: { cookie } }));
    await expect(loaded.json()).resolves.toMatchObject({ apiKeyMasked: "sk-s••••1234" });
  });
});
