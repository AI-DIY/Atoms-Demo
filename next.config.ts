import type { NextConfig } from "next";
import path from "node:path";

export function createNextConfig(platform = process.platform): NextConfig {
  return {
    output: platform === "win32" ? undefined : "standalone",
    outputFileTracingRoot: path.resolve(__dirname),
    experimental: { cpus: 1 },
  };
}

const nextConfig = createNextConfig();

export default nextConfig;
