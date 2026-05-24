import { defineConfig, devices } from "@playwright/test";

// Ubuntu 26.04 isn't yet in Playwright's supported-OS list, so it refuses to
// resolve/launch its bundled browser. The 24.04 x64 build runs fine here; pin to
// it on Linux when the caller hasn't already chosen an override. No effect on
// macOS/Windows.
if (process.platform === "linux" && !process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE) {
  process.env.PLAYWRIGHT_HOST_PLATFORM_OVERRIDE = "ubuntu24.04-x64";
}

// E2E runs against the built + previewed app so the service worker / PWA is active.
export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: "list",
  use: {
    baseURL: "http://localhost:4173",
    trace: "on-first-retry",
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
  ],
  webServer: {
    command: "npm run build && npm run preview -- --port 4173",
    url: "http://localhost:4173",
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
