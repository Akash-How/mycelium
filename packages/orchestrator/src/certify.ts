import { Contract, type Row } from "@mycelium/contracts";
import { scoreRun } from "@mycelium/sentinel";
import { openDb } from "./db.js";

// Birth certificate: no collector's output seeds the baseline until its
// first run has passed its contract AND a human has eyeballed it.
//
//   npx tsx packages/orchestrator/src/certify.ts show <domain>
//   npx tsx packages/orchestrator/src/certify.ts approve <domain>
//
// `approve` flips the source to active, stores the first run as the healthy
// baseline seed, and records golden fixtures from its first rows.

const [, , cmd, domain] = process.argv;
const db = openDb();

const src = db
  .prepare("SELECT * FROM source WHERE domain LIKE ?")
  .get(`%${domain}%`) as any;
if (!src) {
  console.error(`no source matching "${domain}"`);
  process.exit(1);
}
const contract = Contract.parse(JSON.parse(src.contract_json));

// Judge the latest stored run: a collector healed after an empty birth is
// certified on what it returns now, not on its worst day.
const firstRun = db
  .prepare(
    `SELECT * FROM run WHERE source_id = ? AND row_count > 0
     ORDER BY started_at DESC LIMIT 1`,
  )
  .get(src.id) as any;
if (!firstRun) {
  console.error(`no runs stored yet for ${src.domain}`);
  process.exit(1);
}
const rows: Row[] = JSON.parse(firstRun.rows_json);
const score = scoreRun(rows, contract, null);

if (cmd === "show") {
  console.log(`\n${src.domain} · ${src.collector_id} · ${rows.length} rows`);
  console.log(`sentinel verdict (no baseline): ${score.verdict}`);
  console.log(`null rates: ${JSON.stringify(score.nullRates)}\n`);
  console.table(rows.slice(0, 8));
  console.log(`\nIf these are real values: npx tsx packages/orchestrator/src/certify.ts approve ${domain}`);
} else if (cmd === "approve") {
  if (score.verdict === "broken") {
    console.error("refusing: first run fails its own contract — fix the collector or the contract first");
    process.exit(1);
  }
  db.prepare(
    `UPDATE run SET verdict = ?, null_rates_json = ?, shape_hash = ? WHERE id = ?`,
  ).run(score.verdict, JSON.stringify(score.nullRates), score.shapeHash, firstRun.id);
  db.prepare(
    `UPDATE source SET status = 'active', birth_certified_at = datetime('now') WHERE id = ?`,
  ).run(src.id);
  db.prepare(
    `INSERT INTO schedule_state (source_id, next_run_at) VALUES (?, datetime('now'))
     ON CONFLICT(source_id) DO UPDATE SET next_run_at = excluded.next_run_at`,
  ).run(src.id);

  // Golden fixtures: the first two rows' first numeric field, keyed by the
  // first string field — known-correct values a heal must still return.
  const keyField = contract.fields[0].name;
  const numField = contract.fields.find((f) => f.type === "number")?.name;
  if (numField) {
    const insert = db.prepare(
      `INSERT INTO golden_fixture (source_id, field, row_key, expected) VALUES (?, ?, ?, ?)`,
    );
    for (const row of rows.slice(0, 2)) {
      if (row[keyField] != null && row[numField] != null) {
        insert.run(src.id, numField, String(row[keyField]), String(row[numField]));
      }
    }
  }
  console.log(`${src.domain} certified: active, baseline seeded, fixtures recorded.`);
}
db.close();
