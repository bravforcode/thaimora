import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: "tests/live",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3102", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3102",
    url: "http://127.0.0.1:3102",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3102/mock-api",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "contract-test-site-key",
      THAIMORA_SNAPSHOT_PATH: path.resolve("tests/fixtures/live-snapshot.json"),
    },
  },
  projects: [
    { name: "live-contract-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
