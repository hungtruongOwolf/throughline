// Spike check (D1-3): prints a route computed by the Rust engine running as WASM in Node.
import { loadEngine } from "../src-ts/node";

const engine = loadEngine();
const [from = "mp1.entrance", to = "mp2.ct2", mobility = "walking"] = process.argv.slice(2);
const route = engine.walkingRoute({ from, to, mobility: mobility as "walking" | "wheelchair" });
console.log(`engine: rust-wasm ${engine.version()} · campus ${engine.campusVersion()}`);
console.log(`${from} -> ${to} (${mobility}): ${route.seconds} s`);
for (const step of route.steps)
  console.log(`  ${step.kind.padEnd(8)} ${step.to_label} (${step.seconds} s)`);
