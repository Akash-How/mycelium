import { DatabaseSync } from "node:sqlite";
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";

// node:sqlite (built into Node >= 22.5) — no native build step, so the repo
// clones and runs on any machine without a compiler toolchain.

const DB_PATH =
  process.env.MYCELIUM_DB ?? join(process.cwd(), "data", "mycelium.sqlite");

export type Db = DatabaseSync;

export function openDb(path = DB_PATH): DatabaseSync {
  mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  db.exec("PRAGMA journal_mode = WAL");
  db.exec(SCHEMA);
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS candidate (
  id INTEGER PRIMARY KEY,
  url TEXT NOT NULL UNIQUE,
  proposed_by TEXT NOT NULL CHECK (proposed_by IN ('discover','search','seed')),
  probe_score REAL,
  verdict TEXT CHECK (verdict IN ('promoted','discarded')),
  discard_reason TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS source (
  id INTEGER PRIMARY KEY,
  candidate_id INTEGER REFERENCES candidate(id),
  url TEXT NOT NULL,
  domain TEXT NOT NULL,
  intent TEXT NOT NULL,
  collector_id TEXT UNIQUE,
  contract_json TEXT,
  status TEXT NOT NULL DEFAULT 'creating'
    CHECK (status IN ('creating','unproven','active','quarantined','retired')),
  birth_certified_at TEXT,
  quarantined_at TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS run (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES source(id),
  country TEXT NOT NULL,
  trigger_kind TEXT NOT NULL CHECK (trigger_kind IN ('schedule','manual','verify')),
  started_at TEXT NOT NULL,
  finished_at TEXT,
  row_count INTEGER,
  rows_json TEXT,
  null_rates_json TEXT,
  verdict TEXT CHECK (verdict IN ('healthy','degraded','broken','error')),
  shape_hash TEXT
);

CREATE TABLE IF NOT EXISTS incident (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES source(id),
  country TEXT NOT NULL,
  detected_at TEXT NOT NULL,
  symptom_json TEXT NOT NULL,
  prompt TEXT,
  preview_json TEXT,
  gates_json TEXT,
  decision TEXT CHECK (decision IN ('approved','rejected','quarantined','pending')),
  recovered_at TEXT,
  time_to_recovery_s INTEGER
);

CREATE TABLE IF NOT EXISTS golden_fixture (
  id INTEGER PRIMARY KEY,
  source_id INTEGER NOT NULL REFERENCES source(id),
  field TEXT NOT NULL,
  row_key TEXT NOT NULL,
  expected TEXT NOT NULL,
  recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS schedule_state (
  source_id INTEGER PRIMARY KEY REFERENCES source(id),
  next_run_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS spend (
  day TEXT PRIMARY KEY,
  page_loads INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS run_source_time ON run(source_id, started_at DESC);
CREATE INDEX IF NOT EXISTS incident_source_time ON incident(source_id, detected_at DESC);
`;
