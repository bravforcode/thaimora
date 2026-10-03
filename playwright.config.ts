import { defineConfig, devices } from "@playwright/test";
export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3101", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3101",
    url: "http://127.0.0.1:3101",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
  projects: [
    { name: "chromium", use: { ...devices["Desktop Chrome"] } },
    {
      name: "mobile",
      use: { ...devices["Pixel 5"], viewport: { width: 360, height: 800 } },
    },
  ],
});
