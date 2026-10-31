import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";
import { fileURLToPath } from "node:url";

// Workspace packages are resolved through tsconfig paths, not node_modules links,
// because the repo lives on an exFAT drive (no symlinks). See docs/DECISIONS.md.
export const baseVitestConfig = defineConfig({
  plugins: [tsconfigPaths({ root: fileURLToPath(new URL(".", import.meta.url)) })],
  test: { environment: "node" },
});
