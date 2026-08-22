import path from "node:path";
import { describe, expect, it } from "vitest";
import nextConfig, { createNextConfig } from "../../next.config";

describe("Next deployment configuration", () => {
  it("keeps standalone tracing inside the Agent Studio project on Linux", () => {
    expect(createNextConfig("linux")).toMatchObject({
      output: "standalone",
      outputFileTracingRoot: path.resolve(process.cwd()),
    });
  });

  it("avoids standalone symlink copying on Windows", () => {
    expect(createNextConfig("win32").output).toBeUndefined();
    expect(nextConfig.output).toBeUndefined();
  });
});
