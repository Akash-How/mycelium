import type { Db } from "./db.js";
import { Contract, type MyceliumConfig, type Row } from "@mycelium/contracts";
import { detectSymptom, scoreRun } from "@mycelium/sentinel";
import { extractJson, runScraper } from "./bdata.js";
import { baselineFor, healIncident } from "./heal.js";
import { ensureGeoSchema, probeSource } from "./geo.js";
import { normalizeRows } from "./normalize.js";
import { ensureWatchSchema, recordSightings } from "./watch.js";

// The organism's pulse: a visible loop over per-source nextRunAt timestamps,
// capped by config, jittered so N countries never fire at once.
export async function tick(db: Db, cfg: MyceliumConfig) {
  const due = db
    .prepare(
      `SELECT s.id FROM source s
       JOIN schedule_state ss ON ss.source_id = s.id
       WHERE s.status = 'active' AND ss.next_run_at <= datetime('now')`,
    )
    .all() as { id: number }[];

  for (const { id } of due) {
    if (!underBudget(db, cfg)) {
      console.log("[scheduler] daily credit ceiling reached — holding");
      return;
    }
    await sweepSource(db, cfg, id);
    scheduleNext(db, cfg, id);
  }
}

export async function sweepSource(
  db: Db,
  cfg: MyceliumConfig,
  sourceId: number,
) {
  const src = db.prepare("SELECT * FROM source WHERE id = ?").get(sourceId) as any;
  const contract = Contract.parse(JSON.parse(src.contract_json));
  const baseline = baselineFor(db, sourceId);

  // Structured extraction is global (scraper run has no geo flag).
  const startedAt = new Date().toISOString();
  const res = await runScraper(contract.collectorId, contract.sourceUrl);
  recordSpend(db, 1);
  let rows: Row[] = [];
  let verdict = "error";
  let score = null;
  if (res.ok) {
    try {
      rows = normalizeRows(extractJson(res.stdout));
      score = scoreRun(rows, contract, baseline);
      verdict = score.verdict;
    } catch {
      /* verdict stays error */
    }
  }
  db.prepare(
    `INSERT INTO run (source_id, country, trigger_kind, started_at, finished_at,
       row_count, rows_json, null_rates_json, verdict, shape_hash)
     VALUES (?, 'global', 'schedule', ?, datetime('now'), ?, ?, ?, ?, ?)`,
  ).run(
    sourceId,
    startedAt,
    rows.length,
    JSON.stringify(rows.slice(0, 200)),
    JSON.stringify(score?.nullRates ?? {}),
    verdict,
    score?.shapeHash ?? null,
  );

  if (score && score.verdict === "broken") {
    const symptom = detectSymptom(score, baseline, contract, startedAt.slice(0, 10));
    await healIncident(db, sourceId, "global", symptom, cfg.heal);
    return rows;
  }

  // Geo divergence probes ride the unlocker (--country works there): at most
  // once per source per day.
  const lastProbe = db
    .prepare(
      `SELECT MAX(probed_at) AS t FROM geo_probe WHERE source_id = ?`,
    )
    .get(sourceId) as { t: string | null } | undefined;
  const dayAgo = new Date(Date.now() - 24 * 3600_000)
    .toISOString()
    .replace("T", " ")
    .slice(0, 19);
  if (!lastProbe?.t || lastProbe.t < dayAgo) {
    await probeSource(db, sourceId, contract.sourceUrl, cfg.countries);
    recordSpend(db, cfg.countries.length);
  }
  return rows;
}

function scheduleNext(db: Db, cfg: MyceliumConfig, sourceId: number) {
  const gapH = 24 / cfg.schedule.sweepsPerDay;
  const jitterS = Math.floor(Math.random() * cfg.schedule.jitterSeconds);
  db.prepare(
    `INSERT INTO schedule_state (source_id, next_run_at)
     VALUES (?, datetime('now', '+' || ? || ' hours', '+' || ? || ' seconds'))
     ON CONFLICT(source_id) DO UPDATE SET next_run_at = excluded.next_run_at`,
  ).run(sourceId, gapH, jitterS);
}

function underBudget(db: Db, cfg: MyceliumConfig): boolean {
  if (!cfg.budget.hardStop) return true;
  const day = new Date().toISOString().slice(0, 10);
  const row = db.prepare("SELECT page_loads FROM spend WHERE day = ?").get(day) as
    | { page_loads: number }
    | undefined;
  return (row?.page_loads ?? 0) < cfg.budget.creditCeilingPerDay;
}

function recordSpend(db: Db, loads: number) {
  const day = new Date().toISOString().slice(0, 10);
  db.prepare(
    `INSERT INTO spend (day, page_loads) VALUES (?, ?)
     ON CONFLICT(day) DO UPDATE SET page_loads = page_loads + excluded.page_loads`,
  ).run(day, loads);
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function loop(db: Db, cfg: MyceliumConfig) {
  ensureGeoSchema(db);
  ensureWatchSchema(db);
  console.log("[scheduler] heartbeat started");
  for (;;) {
    try {
      await tick(db, cfg);
    } catch (err) {
      console.error("[scheduler] tick failed:", err);
    }
    await sleep(60_000);
  }
}
