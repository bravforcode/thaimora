import { defineConfig, devices } from "@playwright/test";
import path from "node:path";
export default defineConfig({
  testDir: ".", testMatch: "content-freshness.spec.ts", workers: 1,
  use: { baseURL: "http://127.0.0.1:3127", trace: "retain-on-failure" },
  webServer: { command: "npm run dev -- --hostname 127.0.0.1 --port 3127", url: "http://127.0.0.1:3127/guide/", reuseExistingServer: false, timeout: 120000,
    env: { NEXT_PUBLIC_DATA_MODE: "live", NEXT_PUBLIC_API_URL: "http://127.0.0.1:3127/mock-api", THAIMORA_SNAPSHOT_PATH: path.resolve("tests/fixtures/live-snapshot.json") } },
  projects: [{ name: "synthetic-content-contract", use: { ...devices["Desktop Chrome"] } }],
});
