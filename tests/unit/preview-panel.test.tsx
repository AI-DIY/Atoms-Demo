import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { PreviewPanel } from "@/components/workspace/PreviewPanel";

describe("PreviewPanel", () => {
  it("uses a script-only iframe sandbox and switches database versions", () => {
    render(
      <PreviewPanel
        currentVersion={1}
        projectTitle="摄影预约助手"
        versions={[
          { id: "version-1", version: 1, title: "初始版本", html: "<h1>版本一</h1>" },
          { id: "version-2", version: 2, title: "第二版", html: "<h1>版本二</h1>" },
        ]}
      />,
    );

    const preview = screen.getByTitle("Generated application");
    expect(preview).toHaveAttribute(
      "sandbox",
      "allow-scripts",
    );
    expect(preview).toHaveAttribute("srcdoc", expect.stringContaining("版本一"));

    fireEvent.click(screen.getByRole("button", { name: "版本" }));
    const versionTwo = screen.getByRole("button", { name: "V2" });
    fireEvent.click(versionTwo);

    expect(screen.getByText("V2")).toBeInTheDocument();
    expect(screen.getByTitle("Generated application")).toHaveAttribute(
      "srcdoc",
      expect.stringContaining("版本二"),
    );
  });
});
