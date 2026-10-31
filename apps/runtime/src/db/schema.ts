import { integer, primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

/** Seeded reference data. Every row is synthetic (spec 10). */
export const patients = sqliteTable("patients", {
  id: text("id").primaryKey(),
  display_name: text("display_name").notNull(),
  dob: text("dob").notNull(),
  language: text("language", { enum: ["en", "es"] }).notNull(),
  mobility: text("mobility", { enum: ["walking", "wheelchair"] }).notNull(),
  phone_sim: text("phone_sim").notNull(),
  distance_band: text("distance_band").notNull(),
  prior_noshows: integer("prior_noshows").notNull(),
  synthetic: integer("synthetic", { mode: "boolean" }).notNull(),
});

export const providers = sqliteTable("providers", {
  id: text("id").primaryKey(),
  display_name: text("display_name").notNull(),
  station_id: text("station_id").notNull(),
  slot_minutes: integer("slot_minutes").notNull(),
  synthetic: integer("synthetic", { mode: "boolean" }).notNull(),
});

export const slots = sqliteTable(
  "slots",
  {
    station_id: text("station_id").notNull(),
    date: text("date").notNull(),
    time: text("time").notNull(),
    capacity: integer("capacity").notNull(),
    booked: integer("booked").notNull(),
  },
  (t) => [primaryKey({ columns: [t.station_id, t.date, t.time] })],
);

export const meta = sqliteTable("meta", {
  key: text("key").primaryKey(),
  value: text("value").notNull(),
});

/** DDL kept next to the schema; the runtime has no migration history yet (single demo file). */
export const CREATE_TABLES = `
CREATE TABLE IF NOT EXISTS patients (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, dob TEXT NOT NULL, language TEXT NOT NULL,
  mobility TEXT NOT NULL, phone_sim TEXT NOT NULL, distance_band TEXT NOT NULL,
  prior_noshows INTEGER NOT NULL, synthetic INTEGER NOT NULL CHECK (synthetic = 1)
);
CREATE TABLE IF NOT EXISTS providers (
  id TEXT PRIMARY KEY, display_name TEXT NOT NULL, station_id TEXT NOT NULL,
  slot_minutes INTEGER NOT NULL, synthetic INTEGER NOT NULL CHECK (synthetic = 1)
);
CREATE TABLE IF NOT EXISTS slots (
  station_id TEXT NOT NULL, date TEXT NOT NULL, time TEXT NOT NULL,
  capacity INTEGER NOT NULL, booked INTEGER NOT NULL CHECK (booked <= capacity),
  PRIMARY KEY (station_id, date, time)
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
`;

/** Runtime tables: the append-only event log, aggregates, reviews, telemetry, model cache. */
export const CREATE_RUNTIME_TABLES = `
CREATE TABLE IF NOT EXISTS events (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT NOT NULL UNIQUE, type TEXT NOT NULL,
  journey_id TEXT, station_id TEXT, occurred_at TEXT NOT NULL, depth INTEGER NOT NULL,
  json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS events_journey ON events (journey_id, seq);
CREATE TABLE IF NOT EXISTS aggregates (
  kind TEXT NOT NULL, id TEXT NOT NULL, version INTEGER NOT NULL, json TEXT NOT NULL,
  PRIMARY KEY (kind, id)
);
CREATE TABLE IF NOT EXISTS reviews (id TEXT PRIMARY KEY, status TEXT NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_calls (id TEXT PRIMARY KEY, at TEXT NOT NULL, json TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS model_cache (
  key TEXT PRIMARY KEY, provider TEXT NOT NULL, model TEXT NOT NULL, response TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS runtime_log (
  seq INTEGER PRIMARY KEY AUTOINCREMENT, at TEXT NOT NULL, level TEXT NOT NULL, json TEXT NOT NULL
);
`;
