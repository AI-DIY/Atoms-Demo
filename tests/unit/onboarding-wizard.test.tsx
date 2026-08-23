import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { OnboardingWizard } from "@/components/auth/OnboardingWizard";

vi.mock("@/lib/client-api", () => ({
  loadModelConfig: vi.fn().mockResolvedValue(null),
  saveModelConfig: vi.fn(),
  testModelConfig: vi.fn(),
  createProject: vi.fn(),
  completeOnboarding: vi.fn(),
}));

describe("OnboardingWizard", () => {
  it("starts on the model step with three progress markers", () => {
    render(<OnboardingWizard user={{ authenticated: true, email: "user@example.com" }} onComplete={vi.fn()} />);
    expect(screen.getByText("1 账户")).toBeInTheDocument();
    expect(screen.getByText("2 模型")).toBeInTheDocument();
    expect(screen.getByText("3 工作区")).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "配置你的 Responses API 模型" })).toBeInTheDocument();
  });
});
