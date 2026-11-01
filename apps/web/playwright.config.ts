import { defineConfig } from "@playwright/test";

export default defineConfig({
  testDir: "./e2e",
  // All specs share one stateful runtime (they reset and move Maria), so they run in order.
  workers: 1,
  use: { baseURL: "http://localhost:3000" },
  webServer: [
    {
      // The runtime with an in-memory database, so every run starts clean.
      command: "npx tsx src/index.ts",
      cwd: "../runtime",
      url: "http://localhost:4000/health",
      // Replay the recorded live run, exactly as the deployed runtime does (no keys, no calls).
      env: {
        DATABASE_URL: "file::memory:",
        RUNTIME_PORT: "4000",
        SYNTHETIC_ONLY: "true",
        MODEL_CACHE: "replay",
        MODEL_CACHE_PATH: "../../fixtures/model-cache.sqlite",
        OPS_BRAIN: "open",
      },
      reuseExistingServer: true,
    },
    {
      command: "pnpm start",
      url: "http://localhost:3000",
      env: { DEV_PAGES: "1" },
      reuseExistingServer: true,
    },
  ],
});
