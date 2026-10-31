import { mergeConfig } from "vitest/config";
import { baseVitestConfig } from "../../vitest.workspace-config.ts";

export default mergeConfig(baseVitestConfig, { test: { exclude: ["e2e/**", "node_modules/**"] } });
