import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/client-api", () => clientApi);

vi.mock("@/components/studio/StudioApp", () => ({
  StudioApp: ({ user }: { user: { email?: string } }) => <p>首页已加载：{user.email}</p>,
}));

import { AppShell } from "@/components/auth/AppShell";

describe("AppShell", () => {
  beforeEach(() => {
    clientApi.getCurrentUser.mockReset();
    clientApi.getCurrentUser.mockResolvedValue({
      authenticated: true,
      email: "user@example.com",
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("opens the studio home for an authenticated user", async () => {
    render(<AppShell />);

    expect(await screen.findByText("首页已加载：user@example.com")).toBeInTheDocument();
  });
});
