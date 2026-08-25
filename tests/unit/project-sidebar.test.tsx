import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

const registryRole = vi.hoisted(() => ({
  id: "leader",
  label: "注册表负责人",
  icon: () => <span data-testid="registry-role-icon">注册表图标</span>,
  artifactType: "plan",
  systemInstruction: "测试专用角色。",
  aliases: ["注册表负责人"],
}));

vi.mock("@/lib/roles", () => ({ roles: [registryRole] }));

import { ProjectSidebar } from "@/components/workspace/ProjectSidebar";

describe("ProjectSidebar", () => {
  it("renders role labels and icons from the central registry", () => {
    render(<ProjectSidebar loading={false} title="测试项目" />);

    expect(screen.getByText("注册表负责人")).toBeInTheDocument();
    expect(screen.getByTestId("registry-role-icon")).toBeInTheDocument();
    expect(screen.queryByText("团队负责人")).not.toBeInTheDocument();
  });

  it("does not expose a per-user model configuration entry", () => {
    render(<ProjectSidebar loading={false} title="测试项目" />);

    expect(screen.queryByRole("button", { name: "模型配置" })).not.toBeInTheDocument();
  });
});
