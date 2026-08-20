import type { Db } from "./db.js";
import { Contract, type Row } from "@mycelium/contracts";
import {
  compileHealPrompt,
  detectSymptom,
  type Symptom,
  computeBaseline,
  scoreRun,
} from "@mycelium/sentinel";
import { approveHeal, extractJson, healScraper, runScraper } from "./bdata.js";
import { allPass, runGates, type GoldenFixture } from "./gates.js";
import { normalizeRows } from "./normalize.js";

export interface HealOutcome {
  incidentId: number;
  decision: "approved" | "rejected" | "quarantined";
  gates?: ReturnType<typeof runGates>;
}

// The full stage-05 loop for one broken source: detect has already happened
// (the caller hands us the failing score); we diagnose, heal, verify through
// the three gates, then approve or reject. --auto-approve is never used.
export async function healIncident(
  db: Db,
  sourceId: number,
  country: string,
  symptom: Symptom,
  cfg: { maxAttemptsPerIncident: number; quarantineThreshold: number; quarantineWindowHours: number },
): Promise<HealOutcome> {
  const src = db
    .prepare("SELECT * FROM source WHERE id = ?")
    .get(sourceId) as any;
  const contract = Contract.parse(JSON.parse(src.contract_json));

  const detectedAt = new Date().toISOString();
  const { lastInsertRowid } = db
    .prepare(
      `INSERT INTO incident (source_id, country, detected_at, symptom_json, decision)
       VALUES (?, ?, ?, ?, 'pending')`,
    )
    .run(sourceId, country, detectedAt, JSON.stringify(symptom));
  const incidentId = Number(lastInsertRowid);

  // Circuit breaker: three incidents inside the window -> bench, don't heal.
  const windowStart = new Date(
    Date.now() - cfg.quarantineWindowHours * 3600_000,
  ).toISOString();
  const recent = db
    .prepare(
      "SELECT COUNT(*) AS n FROM incident WHERE source_id = ? AND detected_at >= ?",
    )
    .get(sourceId, windowStart) as { n: number };
  if (recent.n >= cfg.quarantineThreshold) {
    quarantine(db, sourceId, incidentId);
    return { incidentId, decision: "quarantined" };
  }

  const prompt = compileHealPrompt(symptom, contract);
  db.prepare("UPDATE incident SET prompt = ? WHERE id = ?").run(
    prompt,
    incidentId,
  );

  const fixtures = db
    .prepare(
      "SELECT field, row_key AS rowKey, expected FROM golden_fixture WHERE source_id = ?",
    )
    .all(sourceId) as GoldenFixture[];
  const lastHealthy = db
    .prepare(
      `SELECT rows_json FROM run
       WHERE source_id = ? AND verdict = 'healthy' AND rows_json IS NOT NULL
       ORDER BY started_at DESC LIMIT 1`,
    )
    .get(sourceId) as { rows_json: string } | undefined;
  const lastHealthyRows: Row[] = lastHealthy
    ? JSON.parse(lastHealthy.rows_json)
    : [];

  for (let attempt = 1; attempt <= cfg.maxAttemptsPerIncident; attempt++) {
    const healed = await healScraper(contract.collectorId, prompt, contract.sourceUrl);
    if (!healed.ok) continue;

    // The heal preview: re-run against the source and judge the output.
    const preview = await runScraper(contract.collectorId, contract.sourceUrl);
    if (!preview.ok) continue;
    const rows = normalizeRows(extractJson(preview.stdout));
    db.prepare("UPDATE incident SET preview_json = ? WHERE id = ?").run(
      JSON.stringify(rows.slice(0, 50)),
      incidentId,
    );

    const gates = runGates(rows, contract, fixtures, lastHealthyRows);
    db.prepare("UPDATE incident SET gates_json = ? WHERE id = ?").run(
      JSON.stringify(gates),
      incidentId,
    );

    if (allPass(gates)) {
      await approveHeal(contract.collectorId, contract.sourceUrl, false);
      const recoveredAt = new Date().toISOString();
      db.prepare(
        `UPDATE incident SET decision = 'approved', recovered_at = ?,
         time_to_recovery_s = CAST((julianday(?) - julianday(detected_at)) * 86400 AS INTEGER)
         WHERE id = ?`,
      ).run(recoveredAt, recoveredAt, incidentId);
      return { incidentId, decision: "approved", gates };
    }

    await approveHeal(contract.collectorId, contract.sourceUrl, true);
  }

  db.prepare("UPDATE incident SET decision = 'rejected' WHERE id = ?").run(
    incidentId,
  );
  quarantine(db, sourceId, incidentId, /* onlyFlag */ false);
  return { incidentId, decision: "rejected" };
}

function quarantine(
  db: Db,
  sourceId: number,
  incidentId: number,
  markIncident = true,
) {
  db.prepare(
    "UPDATE source SET status = 'quarantined', quarantined_at = datetime('now') WHERE id = ?",
  ).run(sourceId);
  if (markIncident) {
    db.prepare("UPDATE incident SET decision = 'quarantined' WHERE id = ?").run(
      incidentId,
    );
  }
}

// After a sweep run has been stored, decide whether it needs an incident.
export function baselineFor(db: Db, sourceId: number) {
  const runs = db
    .prepare(
      `SELECT row_count AS rowCount, null_rates_json FROM run
       WHERE source_id = ? AND verdict = 'healthy'
       ORDER BY started_at DESC LIMIT 5`,
    )
    .all(sourceId) as { rowCount: number; null_rates_json: string }[];
  return computeBaseline(
    runs.map((r) => ({
      rowCount: r.rowCount,
      nullRates: JSON.parse(r.null_rates_json),
    })),
  );
}

export { scoreRun, detectSymptom };
