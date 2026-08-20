import { Contract } from "@mycelium/contracts";
import { extractJson, runScraper } from "./bdata.js";
import { openDb } from "./db.js";
import { normalizeRows } from "./normalize.js";

// Run a collector once (home market) and store the output as a manual run —
// the raw material for the birth certificate. Usage:
//   npx tsx packages/orchestrator/src/firstrun.ts <domain-fragment>

const domain = process.argv[2];
const db = openDb();
const src = db
  .prepare("SELECT * FROM source WHERE domain LIKE ? AND collector_id IS NOT NULL")
  .get(`%${domain}%`) as any;
if (!src) {
  console.error(`no source with a collector matching "${domain}"`);
  process.exit(1);
}
const contract = Contract.parse(JSON.parse(src.contract_json));
const startedAt = new Date().toISOString();
console.log(`[firstrun] ${src.domain} · ${src.collector_id}`);

const res = await runScraper(contract.collectorId, contract.sourceUrl);
if (!res.ok) {
  console.error(res.stderr.slice(-500) || res.stdout.slice(-500));
  process.exit(1);
}
const rows = normalizeRows(extractJson(res.stdout));
db.prepare(
  `INSERT INTO run (source_id, country, trigger_kind, started_at, finished_at, row_count, rows_json, null_rates_json)
   VALUES (?, 'us', 'manual', ?, datetime('now'), ?, ?, '{}')`,
).run(src.id, startedAt, rows.length, JSON.stringify(rows.slice(0, 200)));
console.log(`[firstrun] stored ${rows.length} rows. Next: certify.ts show ${domain}`);
db.close();
