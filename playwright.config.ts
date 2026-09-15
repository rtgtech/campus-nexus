import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./tests/browser",
  timeout: 60_000,
  expect: { timeout: 15_000 },
  workers: 1,
  use: {
    baseURL: "http://127.0.0.1:3100",
    headless: true,
    launchOptions: { executablePath: process.env.BROWSER_EXECUTABLE || "C:/Program Files/Google/Chrome/Application/chrome.exe" },
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    { command: "backend\\venv\\Scripts\\python.exe backend/tests/ui_fixture.py", url: "http://127.0.0.1:5055/health", reuseExistingServer: false },
    { command: "npm run start -- --hostname 127.0.0.1 --port 3100", url: "http://127.0.0.1:3100/auth", reuseExistingServer: false, timeout: 120_000,
      env: { NEXT_BUILD_DIR: ".next-browser", CAMPUS_NEXUS_API_URL: "http://127.0.0.1:5055", NEXT_PUBLIC_CAMPUS_NEXUS_API_URL: "http://127.0.0.1:5055" } },
  ],
});
