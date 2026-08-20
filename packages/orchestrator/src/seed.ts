import { readFileSync } from "node:fs";
import { join } from "node:path";
import { Contract } from "@mycelium/contracts";
import { openDb } from "./db.js";

// Loads fleet.json into the database: candidates (with probe evidence,
// including the discarded ones — rejections are data), and sources with
// their contracts. Idempotent; collector IDs can be filled on later passes.
export function seedFleet(dbPath?: string) {
  const db = openDb(dbPath);
  const fleet = JSON.parse(
    readFileSync(join(process.cwd(), "fleet.json"), "utf8"),
  );

  const upsertCandidate = db.prepare(
    `INSERT INTO candidate (url, proposed_by, probe_score, verdict, discard_reason)
     VALUES (?, ?, ?, ?, ?)
     ON CONFLICT(url) DO UPDATE SET
       probe_score = excluded.probe_score,
       verdict = excluded.verdict,
       discard_reason = excluded.discard_reason`,
  );

  for (const d of fleet.discarded) {
    upsertCandidate.run(d.url, "seed", d.probeScore, "discarded", d.reason);
  }

  for (const s of fleet.sources) {
    upsertCandidate.run(s.url, s.proposedBy, s.probeScore, "promoted", null);
    const cand = db
      .prepare("SELECT id FROM candidate WHERE url = ?")
      .get(s.url) as { id: number };

    const existing = db
      .prepare("SELECT id, collector_id FROM source WHERE url = ?")
      .get(s.url) as { id: number; collector_id: string | null } | undefined;

    const contractJson = s.collectorId
      ? JSON.stringify(
          Contract.parse({
            collectorId: s.collectorId,
            sourceUrl: s.url,
            ...s.contract,
          }),
        )
      : null;

    if (!existing) {
      db.prepare(
        `INSERT INTO source (candidate_id, url, domain, intent, collector_id, contract_json, status)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      ).run(
        cand.id,
        s.url,
        new URL(s.url).hostname,
        fleet.intent,
        s.collectorId,
        contractJson,
        s.collectorId ? "unproven" : "creating",
      );
    } else if (s.collectorId && !existing.collector_id) {
      db.prepare(
        `UPDATE source SET collector_id = ?, contract_json = ?, status = 'unproven'
         WHERE id = ?`,
      ).run(s.collectorId, contractJson, existing.id);
    }
  }

  const counts = db
    .prepare(
      `SELECT status, COUNT(*) AS n FROM source GROUP BY status`,
    )
    .all();
  console.log("[seed] sources by status:", JSON.stringify(counts));
  db.close();
}

if (process.argv[1]?.includes("seed")) seedFleet();
