import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";

describe("PreviewPanel", () => {
  it("uses a script-only iframe sandbox and switches the selected version", () => {
    render(<PreviewPanel projectTitle="摄影预约助手" />);

    expect(screen.getByTitle("Generated application")).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );

    fireEvent.click(screen.getByRole("button", { name: "V2" }));

    expect(screen.getByText("Version V2")).toBeInTheDocument();
  });
});
