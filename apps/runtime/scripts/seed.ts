// `pnpm seed`: rebuilds the SQLite reference data from packages/synthetic with SEED.
import { assertSyntheticOnly } from "@throughline/shared";
import { DEFAULT_SEED } from "@throughline/synthetic";
import { databasePath, openDatabase } from "../src/db/index";
import { seedDatabase } from "../src/db/seed";

assertSyntheticOnly(process.env);
const seed = Number(process.env.SEED ?? DEFAULT_SEED);
const path = databasePath();
const { sqlite } = openDatabase(path);
const counts = seedDatabase(sqlite, seed);
sqlite.close();
console.log(JSON.stringify({ msg: "seeded", seed, path, ...counts }));
