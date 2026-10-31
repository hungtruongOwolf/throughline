# Built during the hackathon

Build window: Oct 27 – Nov 4, 2026. Everything in this repository was written during the window. Nothing was pre-existing except the third-party libraries listed in `package.json`, `pnpm-lock.yaml`, and `Cargo.toml`. The architecture pattern (event → capability → gate → handler, park-and-replay approvals) is inspired by the open EIR project and credited in the README.

## Timeline

| Date       | What was built                                                                                                                                                                                                                               |
| ---------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-10-30 | Build spec (`docs/SPEC.md`); toolchain set up (Rust + wasm-pack, Modal CLI); monorepo scaffold: pnpm + Turborepo, Next.js 15 web app, Hono runtime, shared package, lint/typecheck/test/build, CI, docs                                      |
| 2026-10-30 | `packages/shared`: zod schemas for Journey, events (full catalog + partition), capabilities and gates, agent grants, transition table, HumanReview, OpsAction, QueueState, ModelCallRecord, memory allowlist, EN/ES copy; tests 1, 8, 14, 15 |
