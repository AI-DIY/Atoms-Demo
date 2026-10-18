#!/usr/bin/env node

const origin = process.env.AGENT_STUDIO_ORIGIN || "http://127.0.0.1:3000";

function parseSse(text) {
  return text.replaceAll("\r\n", "\n").split("\n\n").flatMap((block) => {
    const name = block.split("\n").find((line) => line.startsWith("event:"))?.slice(6).trim();
    const data = block.split("\n").find((line) => line.startsWith("data:"))?.slice(5).trim();

    if (!name || !data) return [];
    return [{ name, data: JSON.parse(data) }];
  });
}

async function responseJson(path, init) {
  const response = await fetch(`${origin}${path}`, init);

  if (!response.ok) {
    throw new Error(`${path} returned ${response.status}: ${await response.text()}`);
  }

  return { response, body: await response.json() };
}

async function main() {
  const email = `builder-check-${Date.now()}@example.com`;
  const password = require("node:crypto").randomBytes(24).toString("base64url");
  const { response: registered, body: user } = await responseJson("/api/auth/register", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = registered.headers.getSetCookie?.()[0]?.split(";", 1)[0]
    ?? registered.headers.get("set-cookie")?.split(";", 1)[0];

  if (!cookie || user.authenticated !== true || user.email !== email) {
    throw new Error("Registration did not create an authenticated Builder session");
  }

  const { body: project } = await responseJson("/api/projects", {
    method: "POST",
    headers: { cookie, "content-type": "application/json" },
    body: JSON.stringify({
      title: "Responses API Builder verification",
      goal: "创建一个简洁的摄影预约登记页面，包含客户姓名、预约日期和提交按钮。",
    }),
  });
  const runResponse = await fetch(`${origin}/api/projects/${project.id}/runs`, {
    method: "POST",
    headers: {
      cookie,
      "content-type": "application/json",
      "x-project-token": project.ownerToken,
    },
    body: JSON.stringify({ mode: "team", request: project.goal }),
    signal: AbortSignal.timeout(240_000),
  });

  if (!runResponse.ok) {
    throw new Error(`Builder run returned ${runResponse.status}: ${await runResponse.text()}`);
  }

  const events = parseSse(await runResponse.text());
  const failure = events.find((event) => event.name === "run.failed");

  if (failure) {
    throw new Error(`Builder run failed: ${String(failure.data.error ?? "unknown error")}`);
  }

  if (!events.some((event) => event.name === "run.completed")) {
    throw new Error("Builder run ended without a completion event");
  }

  const { body: completedProject } = await responseJson(`/api/projects/${project.id}`, {
    headers: { cookie, "x-project-token": project.ownerToken },
  });
  const current = completedProject.versions?.find((version) => version.version === completedProject.currentVersion);

  if (completedProject.status !== "ready" || !current?.html) {
    throw new Error("Builder run completed without a ready generated application");
  }

  console.log(JSON.stringify({
    ok: true,
    registrationDirectToBuilder: true,
    completedEvents: events.map((event) => event.name),
    currentVersion: completedProject.currentVersion,
    generatedHtml: true,
  }));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Builder verification failed");
  process.exitCode = 1;
});
