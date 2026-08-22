import { openDb } from "../packages/orchestrator/src/db.js";
import { recordSightings } from "../packages/orchestrator/src/watch.js";
import { Contract } from "../packages/contracts/src/index.js";

const db = openDb();
const srcs = db.prepare(
  "SELECT id, domain, contract_json FROM source WHERE status='active' AND contract_json IS NOT NULL"
).all() as any[];

for (const s of srcs) {
  const run = db.prepare(
    `SELECT rows_json FROM run WHERE source_id=? AND verdict='healthy' AND rows_json IS NOT NULL
     ORDER BY started_at DESC LIMIT 1`
  ).get(s.id) as any;
  if (!run) { console.log(`[backfill] ${s.domain}: no healthy run yet`); continue; }
  const rows = JSON.parse(run.rows_json);
  const contract = Contract.parse(JSON.parse(s.contract_json));
  const r = recordSightings(db, s.id, rows, contract);
  console.log(`[backfill] ${s.domain}: baseline ${rows.length} entities${r.added.length ? `, ${r.added.length} new` : ""}`);
}
db.close();
