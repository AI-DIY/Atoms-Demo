import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/client-api", () => clientApi);

vi.mock("@/components/workspace/WorkspaceShell", () => ({
  WorkspaceShell: ({ userEmail }: { userEmail?: string }) => <p>工作区已加载：{userEmail}</p>,
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

  it("enters the workspace immediately for an authenticated user", async () => {
    render(<AppShell />);

    expect(await screen.findByText("工作区已加载：user@example.com")).toBeInTheDocument();
  });
});
