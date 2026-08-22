import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { WorkspaceShell } from "@/components/workspace/WorkspaceShell";

describe("WorkspaceShell", () => {
  it("renders projects, conversation, and preview regions", () => {
    render(<WorkspaceShell />);

    expect(screen.getByLabelText("Projects")).toBeInTheDocument();
    expect(screen.getByLabelText("Agent conversation")).toBeInTheDocument();
    expect(screen.getByLabelText("Application preview")).toBeInTheDocument();
  });
});

