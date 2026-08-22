import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig from "../../next.config";

describe("Next deployment configuration", () => {
  it("keeps standalone tracing inside the Agent Studio project", () => {
    expect(nextConfig).toMatchObject({
      output: "standalone",
      outputFileTracingRoot: path.resolve(process.cwd()),
    });
  });
});
