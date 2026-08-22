import { describe, expect, it } from "vitest";
import { encodeRunEvent } from "@/lib/run-events";

describe("encodeRunEvent", () => {
  it("encodes a named SSE event", () => {
    expect(encodeRunEvent("step.completed", { role: "pm" })).toBe(
      "event: step.completed\n" + 'data: {"role":"pm"}\n\n',
    );
  });
});
