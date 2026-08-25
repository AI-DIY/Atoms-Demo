# Host Responses API Configuration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send every authenticated user's Builder requests through one Linux-host Responses API configuration and remove per-user model setup.

**Architecture:** `getAgentProvider` constructs an OpenAI Responses provider from validated `RESPONSES_*` host values, or the existing mock provider when explicitly enabled. Authentication only identifies the account; it no longer gates access to the Builder. The Linux host's systemd EnvironmentFile supplies the production values.

**Tech Stack:** Next.js 15, React 19, TypeScript, Zod, OpenAI SDK, Vitest, systemd, Bash.

---

### Task 1: Host provider configuration

**Files:**
- Modify: `src/lib/env.ts`
- Modify: `tests/unit/env.test.ts`

- [ ] **Step 1: Write the failing environment-provider tests**

```ts
expect(getAgentProvider({
  MOCK_LLM: "false",
  RESPONSES_API_BASE_URL: "https://models.example/v1",
  RESPONSES_API_KEY: "server-only-secret",
  RESPONSES_MODEL: "gpt-5.5",
}, createProvider)).toBe(provider);

expect(() => getAgentProvider({ MOCK_LLM: "false" })).toThrow(
  "Host Responses API configuration is incomplete",
);
```

- [ ] **Step 2: Run the focused test to verify it fails**

Run: `pnpm vitest run tests/unit/env.test.ts`

Expected: FAIL because `getAgentProvider` ignores `RESPONSES_*` values.

- [ ] **Step 3: Implement validated host configuration**

```ts
return createProvider({
  baseUrl: environment.RESPONSES_API_BASE_URL!,
  apiKey: environment.RESPONSES_API_KEY!,
  model: environment.RESPONSES_MODEL!,
  maxOutputTokens: parsedMaxOutputTokens,
  reasoningEffort: parsedReasoningEffort,
});
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run tests/unit/env.test.ts`

Expected: PASS.

### Task 2: Direct Builder entry and unified run paths

**Files:**
- Modify: `src/components/auth/AppShell.tsx`
- Modify: `src/app/api/auth/register/route.ts`
- Modify: `src/app/api/auth/login/route.ts`
- Modify: `src/app/api/auth/me/route.ts`
- Modify: `src/app/api/projects/[projectId]/runs/route.ts`
- Modify: `src/app/api/projects/[projectId]/runs/[runId]/approve/route.ts`
- Modify: `src/lib/client-api.ts`
- Modify: `src/lib/user-repository.ts`
- Delete: `src/components/auth/OnboardingWizard.tsx`
- Delete: `src/components/auth/ModelConfigForm.tsx`
- Delete: `src/app/api/model-config/route.ts`
- Delete: `src/app/api/model-config/test/route.ts`
- Delete: `src/lib/model-config.ts`
- Modify: `tests/unit/app-shell.test.tsx`
- Modify: `tests/integration/auth-api.test.ts`
- Modify: `tests/unit/approve-run-route.test.ts`
- Delete: `tests/unit/onboarding-wizard.test.tsx`
- Delete: `tests/unit/model-config-form.test.tsx`
- Delete: `tests/unit/model-config.test.ts`
- Delete: `tests/integration/model-config-api.test.ts`

- [ ] **Step 1: Write failing direct-entry and run-route tests**

```tsx
render(<AppShell />);
expect(await screen.findByText("工作区已加载：user@example.com")).toBeInTheDocument();
```

```ts
expect(getAgentProvider).toHaveBeenCalledWith(process.env);
```

- [ ] **Step 2: Run the affected tests to verify they fail**

Run: `pnpm vitest run tests/unit/app-shell.test.tsx tests/integration/auth-api.test.ts tests/unit/approve-run-route.test.ts`

Expected: FAIL because onboarding and user model configuration still control the flow.

- [ ] **Step 3: Remove the per-user configuration path**

```ts
if (!user?.authenticated) return <AuthPage onAuthenticated={setUser} />;
return <WorkspaceShell userEmail={user.email} />;
```

```ts
provider = getAgentProvider(process.env);
```

- [ ] **Step 4: Run the affected tests to verify they pass**

Run: `pnpm vitest run tests/unit/app-shell.test.tsx tests/integration/auth-api.test.ts tests/unit/approve-run-route.test.ts`

Expected: PASS.

### Task 3: Remove the visible settings entry and document the host setup

**Files:**
- Modify: `src/components/workspace/WorkspaceShell.tsx`
- Modify: `src/components/workspace/ProjectSidebar.tsx`
- Modify: `src/app/globals.css`
- Modify: `.env.example`
- Modify: `README.md`
- Create: `deploy/configure-host-responses.sh`
- Modify: `tests/unit/project-sidebar.test.tsx`

- [ ] **Step 1: Write the failing sidebar assertion**

```tsx
expect(screen.queryByRole("button", { name: "模型配置" })).not.toBeInTheDocument();
```

- [ ] **Step 2: Run it to verify it fails**

Run: `pnpm vitest run tests/unit/project-sidebar.test.tsx`

Expected: FAIL because the settings button is rendered.

- [ ] **Step 3: Remove UI state and add the host configuration script**

```bash
sudo ./deploy/configure-host-responses.sh
# Prompts for Base URL, API Key, model, token limit, and reasoning effort.
# Writes /etc/agent-studio.env with mode 0640 and restarts agent-studio.
```

- [ ] **Step 4: Run the focused test to verify it passes**

Run: `pnpm vitest run tests/unit/project-sidebar.test.tsx`

Expected: PASS.

### Task 4: Build and deploy the Linux release

**Files:**
- Deploy: `/opt/agent-studio` and `/etc/agent-studio.env` on `aliyun-chenzhongliang`

- [ ] **Step 1: Run the local quality gate**

Run: `pnpm test && pnpm exec tsc --noEmit && pnpm build && git diff --check`

Expected: all commands exit 0.

- [ ] **Step 2: Migrate the existing encrypted server configuration internally**

Run a remote Node process that reads `abc@163.com`'s encrypted `ModelConfig`, decrypts it with `/var/lib/agent-studio/.model-config-secret`, and writes the `RESPONSES_*` lines to `/etc/agent-studio.env` without printing the key.

- [ ] **Step 3: Build and activate the server release**

Copy the changed sources to `/opt/agent-studio`, run `pnpm db:generate`, `pnpm build`, copy `.next/static` and `public` into `.next/standalone`, then restart `agent-studio`.

- [ ] **Step 4: Verify the service and real API**

Run `systemctl is-active agent-studio`, an in-process `OpenAI.responses.create` using only `/etc/agent-studio.env`, and an authenticated Builder request. Confirm only success metadata is printed.
