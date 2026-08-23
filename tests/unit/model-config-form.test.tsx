import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { ModelConfigForm } from "@/components/auth/ModelConfigForm";

vi.mock("@/lib/client-api", () => ({
  loadModelConfig: vi.fn().mockResolvedValue(null),
  saveModelConfig: vi.fn(),
  testModelConfig: vi.fn(),
}));

describe("ModelConfigForm", () => {
  it("renders connection and runtime metadata fields", () => {
    render(<ModelConfigForm />);
    expect(screen.getByLabelText("Base URL")).toBeInTheDocument();
    expect(screen.getByLabelText("API Key")).toBeInTheDocument();
    expect(screen.getByLabelText("模型 ID")).toBeInTheDocument();
    expect(screen.getByLabelText("最大输出 Token")).toBeInTheDocument();
    expect(screen.getByLabelText("推理强度")).toBeInTheDocument();
  });
});
