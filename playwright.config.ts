import { defineConfig, devices } from "@playwright/test";

/**
 * Playwright E2E config for LaundryBoss
 * Run: npm run test:e2e
 * Requires app running at baseURL (default: http://localhost:5173)
 */
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: "html",
  use: {
    baseURL:
      process.env.PLAYWRIGHT_BASE_URL ||
      (process.env.CI ? "http://localhost:4173" : "http://localhost:5173"),
    ignoreHTTPSErrors: true,
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    { name: "Mobile Chrome", use: { ...devices["Pixel 5"] } },
  ],
  webServer: {
    command: process.env.CI ? "npm run build && npm run preview" : "npm run dev",
    url: process.env.CI ? "http://localhost:4173" : "http://localhost:5173",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
