import { defineConfig, devices } from "@playwright/test";
import { existsSync } from "node:fs";

const port = 1420;
const baseURL = `http://127.0.0.1:${port}`;
const localChromiumPath = "/usr/bin/brave-browser";
const executablePath =
  process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ??
  (existsSync(localChromiumPath) ? localChromiumPath : undefined);

export default defineConfig({
  testDir: "./tests/e2e",
  webServer: {
    command: "npm run dev -- --host 127.0.0.1",
    url: baseURL,
    reuseExistingServer: true,
  },
  use: {
    ...devices["Desktop Chrome"],
    baseURL,
    launchOptions: executablePath ? { executablePath } : undefined,
  },
});
