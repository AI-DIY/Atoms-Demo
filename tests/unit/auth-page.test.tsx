import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AuthPage } from "@/components/auth/AuthPage";

const { loginUser, registerUser } = vi.hoisted(() => ({ loginUser: vi.fn(), registerUser: vi.fn() }));
vi.mock("@/lib/client-api", () => ({ loginUser, registerUser }));

describe("AuthPage", () => {
  it("switches between login and registration", () => {
    render(<AuthPage onAuthenticated={vi.fn()} />);
    expect(screen.getByRole("button", { name: "登录" })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "还没有账户？注册" }));
    expect(screen.getByRole("button", { name: "注册" })).toBeInTheDocument();
  });
});
