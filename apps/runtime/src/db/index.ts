import { existsSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";

/** The monorepo root: works from src/ under tsx and from the bundled dist/. */
function repoRoot(): string {
  let dir = dirname(fileURLToPath(import.meta.url));
  while (!existsSync(join(dir, "pnpm-workspace.yaml"))) {
    const parent = dirname(dir);
    if (parent === dir) return process.cwd();
    dir = parent;
  }
  return dir;
}

/** `file:./data/throughline.sqlite` → an absolute path, resolved from the repo root. */
export function databasePath(
  url = process.env.DATABASE_URL ?? "file:./data/throughline.sqlite",
): string {
  const path = url.replace(/^file:/, "");
  return path === ":memory:" ? path : resolve(repoRoot(), path);
}

export function openDatabase(path = databasePath()) {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const sqlite = new Database(path);
  sqlite.pragma("journal_mode = WAL");
  sqlite.exec(schema.CREATE_TABLES);
  return { sqlite, db: drizzle(sqlite, { schema }) };
}

export { schema };
