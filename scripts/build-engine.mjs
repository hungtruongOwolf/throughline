// Builds the Rust engine for both hosts (spec 7.1) and copies the web .wasm into apps/web/public.
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const engine = join(root, "packages/engine");
const env = {
  ...process.env,
  PATH: [join(homedir(), ".cargo/bin"), process.env.PATH].join(delimiter),
};
const release = process.argv.includes("--dev") ? "--dev" : "--release";

for (const [target, outDir, type] of [
  ["web", "pkg-web", "module"],
  ["nodejs", "pkg-node", "commonjs"],
]) {
  execFileSync(
    "wasm-pack",
    ["build", release, "--target", target, "--out-dir", outDir, "--no-pack"],
    {
      cwd: engine,
      env,
      stdio: "inherit",
      shell: process.platform === "win32",
    },
  );
  // --no-pack skips wasm-pack's package.json; declare the module type so Node and vitest agree.
  writeFileSync(join(engine, outDir, "package.json"), `${JSON.stringify({ type })}\n`);
}

mkdirSync(join(root, "apps/web/public"), { recursive: true });
copyFileSync(
  join(engine, "pkg-web/throughline_engine_bg.wasm"),
  join(root, "apps/web/public/engine_bg.wasm"),
);
console.log("engine built: pkg-web, pkg-node, apps/web/public/engine_bg.wasm");
