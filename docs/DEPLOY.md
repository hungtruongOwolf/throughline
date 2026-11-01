# Deploy

The public demo runs in **replay mode**. The model outputs come from a recorded live run
(`fixtures/model-cache.sqlite`), so the deployed services hold no API keys and make no model
calls.

| Part                 | Where                                                    | URL                                                                        |
| -------------------- | -------------------------------------------------------- | -------------------------------------------------------------------------- |
| Web (Next.js)        | Vercel, project `throughline`, root directory `apps/web` | https://throughline-zeta-ten.vercel.app                                    |
| Runtime (Node, Hono) | Modal, app `throughline-runtime`, one container          | https://hungkhanh-truong112--throughline-runtime-runtime.us-east.modal.run |

## Runtime on Modal

```sh
python -m modal deploy deploy/modal_runtime.py
```

The image installs Node 22 and pnpm and copies the workspace, including the built engine in
`packages/engine/pkg-node`. Run `pnpm build:engine` first.

The container starts the runtime with these settings:

- `MODEL_CACHE=replay`
- `MODEL_CACHE_PATH=/app/fixtures/model-cache.sqlite`
- `OPS_BRAIN=open`
- an in-memory event store

At boot the runtime builds the hospital as of Nov 17, 9:53 am (`apps/runtime/src/demo/population.ts`, about 2 seconds in replay) and lets the clock run in real time; after 10 idle minutes following a visitor's change it rebuilds it. The development routes (`/api/admin/*`, `/api/story*`, `/api/demo/*`, clock changes) need the `x-admin-token` header; deploy with `ADMIN_TOKEN` set in your shell (it travels as a Modal secret).

There is one container at most, because the event store lives in memory. `min_containers=1` keeps it warm for visitors.

## Web on Vercel

```sh
vercel deploy --prod
```

Run this from the repository root.

Project settings:

- Root directory: `apps/web`
- Install command: `pnpm install --frozen-lockfile`
- Build command: `pnpm run build`
- Files outside the root directory: allowed

Production environment variable:

- `NEXT_PUBLIC_RUNTIME_URL`: the Modal URL

`.vercelignore` uploads the built engine (`pkg-web`, `engine_bg.wasm`). Vercel has no Rust
toolchain to build it.

## Re-recording the live run

You need `META_API_KEY` and `BASETEN_API_KEY` in `.env`. Re-record after any change to a
prompt or a tool:

```sh
pnpm --filter @throughline/runtime record:population
```

The script plays the whole story with live models; only requests that are not yet in the cache
go out. It then replays the story and checks for no fallbacks and the same events. Redeploy the
runtime afterwards.
