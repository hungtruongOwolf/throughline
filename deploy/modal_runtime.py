"""Deploys the Throughline runtime to Modal in replay mode (DEPLOY.md).

The container serves the recorded live run from fixtures/model-cache.sqlite: no API keys are
sent to it and it makes no model calls. At boot it builds the hospital as of Nov 17, 9:53 am
(apps/runtime/src/demo/population.ts) and restores it after visitors leave it idle. One
container holds the in-memory event store, so max_containers is 1, and min_containers keeps it
warm for visitors.

    modal deploy deploy/modal_runtime.py
"""

import os
import subprocess
from pathlib import Path

import modal

ROOT = Path(__file__).resolve().parent.parent
PORT = 4000

image = (
    modal.Image.debian_slim(python_version="3.12")
    .apt_install("curl", "ca-certificates", "gnupg")
    .run_commands(
        "curl -fsSL https://deb.nodesource.com/setup_22.x | bash -",
        "apt-get install -y nodejs",
        "npm install -g pnpm@10",
    )
    .add_local_dir(
        ROOT,
        "/app",
        copy=True,
        ignore=[
            "**/node_modules/**",
            "**/.next/**",
            "**/.turbo/**",
            "**/target/**",
            "**/test-results/**",
            "data/**",
            ".git/**",
            ".env",
            ".env.*",
            "docs/**",
            "*.sqlite-wal",
            "*.sqlite-shm",
            "**/__pycache__/**",
        ],
    )
    .env({"PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD": "1", "CI": "1"})
    .run_commands("cd /app && pnpm install --frozen-lockfile")
)

app = modal.App("throughline-runtime")


# The development routes (restore, clock jump) need this token. It is read from the deployer's
# environment and travels to the container as a Modal secret, never through the repo.
if not os.environ.get("ADMIN_TOKEN"):
    raise SystemExit("Set ADMIN_TOKEN before deploying: the development routes stay closed without it.")
ADMIN = modal.Secret.from_dict({"ADMIN_TOKEN": os.environ.get("ADMIN_TOKEN", "")})


@app.function(
    image=image,
    secrets=[ADMIN],
    min_containers=1,
    max_containers=1,
    # Any US region, so a busy zone never leaves the runtime unscheduled.
    region="us",
    scaledown_window=30 * 60,
    timeout=24 * 60 * 60,
)
@modal.concurrent(max_inputs=200)
@modal.web_server(PORT, startup_timeout=180)
def runtime() -> None:
    env = {
        "PATH": "/usr/local/bin:/usr/bin:/bin",
        "DATABASE_URL": "file::memory:",
        "RUNTIME_PORT": str(PORT),
        "SYNTHETIC_ONLY": "true",
        "MODEL_CACHE": "replay",
        "MODEL_CACHE_PATH": "/app/fixtures/model-cache.sqlite",
        "OPS_BRAIN": "open",
        "TIER_MODE": "cloud_only",
        "NODE_ENV": "production",
        "ADMIN_TOKEN": os.environ.get("ADMIN_TOKEN", ""),
    }
    subprocess.Popen(
        ["npx", "tsx", "src/index.ts"],
        cwd="/app/apps/runtime",
        env=env,
    )
