import type { Db } from "./db.js";
import type { Contract, Row } from "@mycelium/contracts";

// New-entity watcher. In a bug-bounty context the first submission wins, so
// the valuable signal is not "the price changed" but "something appeared that
// was never here before". Every verified run is diffed against every entity
// this source has ever shown; additions are recorded with a first-seen stamp.
//
// This only ever runs on runs the sentinel scored healthy, so a broken scraper
// can never manufacture a fake "new program" — the gates protect the alert.

export function ensureWatchSchema(db: Db) {
  db.exec(`CREATE TABLE IF NOT EXISTS discovery (
    id INTEGER PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES source(id),
    entity_key TEXT NOT NULL,
    first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
    payload_json TEXT NOT NULL,
    seeded INTEGER NOT NULL DEFAULT 0
  )`);
  db.exec(
    `CREATE UNIQUE INDEX IF NOT EXISTS discovery_unique
     ON discovery(source_id, entity_key)`,
  );
}

export function entityKey(row: Row, contract: Contract): string {
  const idField =
    contract.fields.find((f) => f.type === "string" && f.required)?.name ??
    contract.fields[0].name;
  return String(row[idField] ?? "").trim().toLowerCase();
}

export interface WatchResult {
  isFirstSweep: boolean;
  added: { key: string; row: Row }[];
}

/**
 * Diff a healthy run against everything previously seen for this source.
 * The first sweep seeds the baseline (marked `seeded`) and reports nothing —
 * otherwise every program on day one would look like breaking news.
 */
export function recordSightings(
  db: Db,
  sourceId: number,
  rows: Row[],
  contract: Contract,
): WatchResult {
  ensureWatchSchema(db);

  const known = new Set(
    (
      db
        .prepare("SELECT entity_key FROM discovery WHERE source_id = ?")
        .all(sourceId) as { entity_key: string }[]
    ).map((r) => r.entity_key),
  );
  const isFirstSweep = known.size === 0;

  const insert = db.prepare(
    `INSERT OR IGNORE INTO discovery (source_id, entity_key, payload_json, seeded)
     VALUES (?, ?, ?, ?)`,
  );

  const added: { key: string; row: Row }[] = [];
  for (const row of rows) {
    const key = entityKey(row, contract);
    if (!key || known.has(key)) continue;
    known.add(key);
    insert.run(sourceId, key, JSON.stringify(row), isFirstSweep ? 1 : 0);
    if (!isFirstSweep) added.push({ key, row });
  }
  return { isFirstSweep, added };
}
