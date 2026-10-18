import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/live",
  workers: 1,
  timeout: 600_000,
  expect: { timeout: 180_000 },
  reporter: "list",
  outputDir: ".artifacts/live-results",
  use: {
    ...devices["Desktop Chrome"],
    baseURL: process.env.DEMO_URL ?? "http://atoms.ai-diy.me",
    screenshot: "only-on-failure",
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH } : undefined,
  },
});
