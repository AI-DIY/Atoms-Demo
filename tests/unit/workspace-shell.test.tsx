import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { defaultProject } from "@/lib/default-project";
import { projectIdentityStorageKey } from "@/lib/project-session";

const clientApi = vi.hoisted(() => ({
  createProject: vi.fn(),
  loadProject: vi.fn(),
}));

vi.mock("@/lib/client-api", () => clientApi);

import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

const createdProject = {
  id: "project-1",
  ownerToken: "owner-token-1",
  ...defaultProject,
  status: "draft",
};

const loadedProject = {
  id: "project-1",
  ...defaultProject,
  status: "draft",
  currentVersion: 0,
};

describe("WorkspaceShell", () => {
  beforeEach(() => {
    window.localStorage.clear();
    clientApi.createProject.mockReset();
    clientApi.loadProject.mockReset();
    clientApi.createProject.mockResolvedValue(createdProject);
    clientApi.loadProject.mockResolvedValue(loadedProject);
  });

  afterEach(() => {
    cleanup();
  });

  it("renders projects, conversation, and preview regions", () => {
    render(<WorkspaceShell />);

    expect(screen.getByLabelText("Projects")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent conversation")).toBeInTheDocument();
    expect(screen.getByLabelText("Application preview")).toBeInTheDocument();
  });

  it("creates the default project once, saves its identity, and loads it", async () => {
    render(<WorkspaceShell />);

    await waitFor(() => {
      expect(screen.getAllByText(defaultProject.title)).not.toHaveLength(0);
    });

    expect(clientApi.createProject).toHaveBeenCalledWith(defaultProject);
    expect(clientApi.loadProject).toHaveBeenCalledWith({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
    expect(JSON.parse(window.localStorage.getItem(projectIdentityStorageKey) ?? "{}")).toEqual({
      projectId: "project-1",
      ownerToken: "owner-token-1",
    });
  });

  it("reuses a stored identity by loading instead of creating", async () => {
    window.localStorage.setItem(
      projectIdentityStorageKey,
      JSON.stringify({ projectId: "project-1", ownerToken: "owner-token-1" }),
    );

    render(<WorkspaceShell />);

    await waitFor(() => {
      expect(clientApi.loadProject).toHaveBeenCalledWith({
        projectId: "project-1",
        ownerToken: "owner-token-1",
      });
    });

    expect(clientApi.createProject).not.toHaveBeenCalled();
  });
});
