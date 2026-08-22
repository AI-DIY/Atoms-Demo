import { describe, expect, it } from "vitest";
import { transitionProject } from "@/lib/project-state";

describe("transitionProject", () => {
  it("only starts building after explicit approval", () => {
    expect(transitionProject("awaiting_approval", "approve")).toBe("building");
    expect(() => transitionProject("planning", "approve")).toThrow("Invalid transition");
  });

  it("allows failed projects to restart planning", () => {
    expect(transitionProject("failed", "retry")).toBe("planning");
  });
});

