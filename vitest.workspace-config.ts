import { defineConfig } from "vitest/config";

// Workspace packages are resolved through tsconfig paths, not node_modules links,
// because the repo lives on an exFAT drive (no symlinks). See docs/DECISIONS.md #16.
export const baseVitestConfig = defineConfig({
  resolve: { tsconfigPaths: true },
  test: { environment: "node" },
});
