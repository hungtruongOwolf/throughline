import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  use: { baseURL: "http://localhost:3000" },
  webServer: [
    {
      // The runtime with an in-memory database, so every run starts clean.
      command: "npx tsx src/index.ts",
      cwd: "../runtime",
      url: "http://localhost:4000/health",
      env: { DATABASE_URL: "file::memory:", RUNTIME_PORT: "4000", SYNTHETIC_ONLY: "true" },
      reuseExistingServer: true,
    },
    { command: "pnpm start", url: "http://localhost:3000", reuseExistingServer: true },
  ],
});
