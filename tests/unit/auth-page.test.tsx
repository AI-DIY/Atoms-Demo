import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthPage } from "@/components/auth/AuthPage";

const { loginUser, registerUser } = vi.hoisted(() => ({ loginUser: vi.fn(), registerUser: vi.fn() }));
vi.mock("@/lib/client-api", () => ({ loginUser, registerUser }));

describe("AuthPage", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    loginUser.mockReset();
    registerUser.mockReset();
  });

  it("switches between login and registration", () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还没有账户？注册" }));
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
  });

  it("shows a registration loading state and locks the form until the request completes", async () => {
    let resolveRegistration!: (user: { authenticated: boolean; email: string }) => void;
    registerUser.mockReturnValue(new Promise((resolve) => {
      resolveRegistration = resolve;
    }));

    render(<AuthPage onAuthenticated={vi.fn()} />);
    fireEvent.click(screen.getByRole("button", { name: "还没有账户？注册" }));
    fireEvent.change(screen.getByLabelText("邮箱"), { target: { value: "new@example.com" } });
    fireEvent.change(screen.getByLabelText("密码"), { target: { value: "password123" } });
    fireEvent.click(screen.getByRole("button", { name: "注册" }));

    await waitFor(() => {
      expect(screen.getByRole("form", { name: "账户注册" })).toHaveAttribute("aria-busy", "true");
      expect(screen.getByRole("button", { name: "注册中" })).toBeDisabled();
      expect(screen.getByLabelText("邮箱")).toBeDisabled();
      expect(screen.getByLabelText("密码")).toBeDisabled();
    });

    resolveRegistration({ authenticated: true, email: "new@example.com" });

    await waitFor(() => {
      expect(screen.getByRole("form", { name: "账户注册" })).toHaveAttribute("aria-busy", "false");
    });
  });
});
