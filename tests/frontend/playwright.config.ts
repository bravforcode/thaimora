import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: ".",
  testMatch: "material-fixes.spec.ts",
  workers: 1,
  use: { baseURL: "http://127.0.0.1:3104", trace: "retain-on-failure" },
  webServer: {
    command: "npm run dev -- --hostname 127.0.0.1 --port 3104",
    url: "http://127.0.0.1:3104",
    reuseExistingServer: false,
    timeout: 120000,
    env: {
      NEXT_PUBLIC_DATA_MODE: "live",
      NEXT_PUBLIC_API_URL: "http://127.0.0.1:3104/mock-api",
      NEXT_PUBLIC_TURNSTILE_SITE_KEY: "mock-turnstile",
      THAIMORA_SNAPSHOT_PATH: path.resolve("tests/fixtures/live-snapshot.json"),
    },
  },
  projects: [
    { name: "material-chromium", use: { ...devices["Desktop Chrome"] } },
  ],
});
