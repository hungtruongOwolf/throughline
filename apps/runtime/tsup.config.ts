import { defineConfig } from "tsup";

// Bundles workspace packages (resolved via tsconfig paths) into dist; npm deps stay external.
export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  tsconfig: "tsconfig.json",
  noExternal: [/^@throughline\//],
  clean: true,
});
