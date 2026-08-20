import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { openDb } from "@mycelium/orchestrator/src/db.js";

// Stage 06: the verified dataset leaves the system as a product. Read-only —
// serving is only honest because Survive runs first.

const db = openDb();
const app = new Hono();

app.get("/health", (c) => c.json({ ok: true }));

app.get("/sources", (c) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.url, s.domain, s.collector_id, s.status,
              s.birth_certified_at, s.quarantined_at, s.contract_json,
              (SELECT verdict FROM run r WHERE r.source_id = s.id
               ORDER BY r.started_at DESC LIMIT 1) AS last_verdict
       FROM source s ORDER BY s.id`,
    )
    .all() as any[];
  return c.json(
    rows.map((r) => ({
      ...r,
      contract: JSON.parse(r.contract_json ?? "null"),
      contract_json: undefined,
    })),
  );
});

app.get("/runs", (c) => {
  const sourceId = c.req.query("source");
  const limit = Math.min(Number(c.req.query("limit") ?? 50), 500);
  const rows = sourceId
    ? db
        .prepare(
          `SELECT id, source_id, country, trigger_kind, started_at, row_count, verdict
           FROM run WHERE source_id = ? ORDER BY started_at DESC LIMIT ?`,
        )
        .all(sourceId, limit)
    : db
        .prepare(
          `SELECT id, source_id, country, trigger_kind, started_at, row_count, verdict
           FROM run ORDER BY started_at DESC LIMIT ?`,
        )
        .all(limit);
  return c.json(rows);
});

app.get("/incidents", (c) => {
  const rows = db
    .prepare(
      `SELECT i.*, s.url, s.domain FROM incident i
       JOIN source s ON s.id = i.source_id
       ORDER BY i.detected_at DESC LIMIT 100`,
    )
    .all() as any[];
  return c.json(
    rows.map((r) => ({
      ...r,
      symptom: JSON.parse(r.symptom_json ?? "null"),
      gates: JSON.parse(r.gates_json ?? "null"),
      preview_sample: (JSON.parse(r.preview_json ?? "[]") as unknown[]).slice(0, 3),
      symptom_json: undefined,
      gates_json: undefined,
      preview_json: undefined,
    })),
  );
});

app.get("/reliability", (c) => {
  const fleet = db
    .prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN status = 'active' THEN 1 ELSE 0 END) AS active,
      SUM(CASE WHEN status = 'quarantined' THEN 1 ELSE 0 END) AS quarantined
      FROM source`)
    .get();
  const heals = db
    .prepare(`SELECT
      COUNT(*) AS incidents,
      SUM(CASE WHEN decision = 'approved' THEN 1 ELSE 0 END) AS approved,
      SUM(CASE WHEN decision = 'rejected' THEN 1 ELSE 0 END) AS rejected,
      AVG(time_to_recovery_s) AS mean_recovery_s
      FROM incident`)
    .get();
  const runs = db
    .prepare(`SELECT COUNT(*) AS total,
      SUM(CASE WHEN verdict = 'healthy' THEN 1 ELSE 0 END) AS healthy
      FROM run`)
    .get();
  return c.json({ fleet, heals, runs });
});

// The latest verified rows per source, per country — what downstream code
// actually consumes.
app.get("/export.json", (c) => {
  const sourceId = c.req.query("source");
  const where = sourceId ? "AND r.source_id = ?" : "";
  const rows = db
    .prepare(
      `SELECT r.source_id, s.domain, r.country, r.started_at, r.rows_json
       FROM run r JOIN source s ON s.id = r.source_id
       WHERE r.verdict = 'healthy' ${where}
         AND r.started_at = (
           SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id = r.source_id AND r2.country = r.country
             AND r2.verdict = 'healthy')
       ORDER BY r.source_id, r.country`,
    )
    .all(...(sourceId ? [sourceId] : [])) as any[];
  return c.json(
    rows.map((r) => ({
      source_id: r.source_id,
      domain: r.domain,
      country: r.country,
      as_of: r.started_at,
      rows: JSON.parse(r.rows_json ?? "[]"),
    })),
  );
});

app.get("/export.csv", (c) => {
  const sourceId = c.req.query("source");
  const where = sourceId ? "AND r.source_id = ?" : "";
  const data = db
    .prepare(
      `SELECT s.domain, r.country, r.started_at, r.rows_json
       FROM run r JOIN source s ON s.id = r.source_id
       WHERE r.verdict = 'healthy' ${where}
         AND r.started_at = (
           SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id = r.source_id AND r2.country = r.country
             AND r2.verdict = 'healthy')`,
    )
    .all(...(sourceId ? [sourceId] : [])) as any[];

  const lines = ["domain,country,as_of,field,row_index,value"];
  for (const d of data) {
    const rows = JSON.parse(d.rows_json ?? "[]") as Record<string, unknown>[];
    rows.forEach((row, i) => {
      for (const [k, v] of Object.entries(row)) {
        const val = String(v ?? "").replaceAll('"', '""');
        lines.push(`${d.domain},${d.country},${d.started_at},${k},${i},"${val}"`);
      }
    });
  }
  c.header("Content-Type", "text/csv");
  return c.body(lines.join("\n"));
});

// Geo divergence probes: page-level price signals per market, via the
// unlocker's --country (structured runs are global — see geo.ts).
app.get("/geo", (c) => {
  const rows = db
    .prepare(
      `SELECT g.source_id, s.domain, g.country, g.probed_at, g.signal_count,
              g.top_signals, g.currency_set
       FROM geo_probe g JOIN source s ON s.id = g.source_id
       WHERE g.probed_at = (
         SELECT MAX(g2.probed_at) FROM geo_probe g2
         WHERE g2.source_id = g.source_id AND g2.country = g.country)
       ORDER BY g.source_id, g.country`,
    )
    .all() as any[];
  return c.json(
    rows.map((r) => ({
      ...r,
      top_signals: JSON.parse(r.top_signals),
      currency_set: JSON.parse(r.currency_set),
    })),
  );
});

app.use("/*", async (c, next) => {
  await next();
  // the page changes constantly during the hackathon — never let browsers cache it
  if (c.req.path === "/" || c.req.path.endsWith(".html")) c.header("Cache-Control", "no-store");
});
app.use("/*", serveStatic({ root: "./apps/api/public" }));

const port = Number(process.env.PORT ?? 4000);
serve({ fetch: app.fetch, port });
console.log(`[api] listening on http://localhost:${port}`);
