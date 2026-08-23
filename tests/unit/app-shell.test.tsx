import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const clientApi = vi.hoisted(() => ({
  getCurrentUser: vi.fn(),
}));

vi.mock("@/lib/client-api", () => clientApi);

vi.mock("@/components/auth/OnboardingWizard", () => ({
  OnboardingWizard: ({ onComplete }: { onComplete: (user: { authenticated: boolean; email: string; onboardingCompleted: boolean; hasModelConfig: boolean }) => void }) => (
    <button
      type="button"
      onClick={() => onComplete({
        authenticated: true,
        email: "user@example.com",
        onboardingCompleted: true,
        hasModelConfig: true,
      })}
    >
      进入工作区
    </button>
  ),
}));

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
      onboardingCompleted: false,
      hasModelConfig: false,
    });
  });

  afterEach(() => {
    cleanup();
  });

  it("uses the completed onboarding user state to enter the workspace immediately", async () => {
    render(<AppShell />);

    fireEvent.click(await screen.findByRole("button", { name: "进入工作区" }));

    expect(await screen.findByText("工作区已加载：user@example.com")).toBeInTheDocument();
  });
});
