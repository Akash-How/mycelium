import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { Hono } from "hono";
import { openDb } from "@mycelium/orchestrator/src/db.js";

// Stage 06: the verified dataset leaves the system as a product. Read-only —
// serving is only honest because Survive runs first.

const db = openDb();
const app = new Hono();

// ---- row shapes -----------------------------------------------------------
// node:sqlite returns untyped records; each query narrows to the columns it
// actually selects so property access stays checked.
type DiscoveryRow = {
  first_seen_at: string; entity_key: string; payload_json: string;
  domain: string; source_id: number; seeded: number;
};
type LatestRunRow = { rows_json: string | null; domain: string };
type ExportRow = {
  source_id: number; domain: string; country: string;
  started_at: string; rows_json: string | null; row_count: number;
};
type SourceRow = {
  id: number; url: string; domain: string; collector_id: string | null;
  status: string; birth_certified_at: string | null;
  quarantined_at: string | null; contract_json: string | null;
  last_verdict: string | null;
};
type IncidentRow = Record<string, unknown> & {
  symptom_json: string | null; gates_json: string | null; preview_json: string | null;
};
type GeoRow = Record<string, unknown> & { top_signals: string; currency_set: string };
type Program = { program: unknown; bounty: number; platform: string; category: unknown };

// ---- field helpers --------------------------------------------------------
// Every platform names its columns differently; the picker chains below are
// the union of what the collectors' contracts actually emit.
type Fields = Record<string, unknown>;
const programName = (row: Fields) =>
  row.program_name ?? row.name ?? row.title ?? row.project_name;
const maxBounty = (row: Fields) =>
  row.max_bounty ?? row.bounty_reward_max ?? row.max_reward;
/** collapse listing subdomains (www., api., app.) to the platform's name */
const platformOf = (domain: string) => domain.replace(/^(www|api|app)\./, "");
/** "$100,000" | 100000 | junk -> number (0 when unparseable) */
const num = (v: unknown): number => {
  if (typeof v === "number") return v;
  if (typeof v === "string") {
    const n = Number(v.replace(/[^0-9.]/g, ""));
    return Number.isFinite(n) ? n : 0;
  }
  return 0;
};

// the dataset is a public product: any origin may read it
app.use("*", async (c, next) => {
  await next();
  c.header("Access-Control-Allow-Origin", "*");
  c.header("Access-Control-Allow-Methods", "GET");
});

app.get("/health", (c) => c.json({ ok: true }));

// self-describing index so consumers can discover the surface
app.get("/api", (c) =>
  c.json({
    name: "Mycelium",
    description:
      "Self-healing web data network. All data is verified before serving.",
    endpoints: {
      "/export.json?source=N": "latest verified rows per source (omit source for all)",
      "/export.csv?source=N": "same dataset as tidy CSV (field,row_index,value)",
      "/history?source=N": "full time series: every verified run's rows for one source",
      "/sources": "the fleet: status, contract, certification",
      "/runs?source=N&limit=M": "run log: verdicts and row counts",
      "/incidents": "every break: symptom, machine-written heal prompt, gates, decision",
      "/new?hours=N": "programs first seen since baseline — the first-submission signal",
      "/newest?limit=N&per=M": "programs newest-first with their reward; per=M takes the M most recent from each platform",
      "/top?limit=N&per=M": "highest-reward programs; per=M caps how many each platform contributes",
      "/signals": "aggregate vectors: top bounty, median, count above 10k, new this week",
      "/watchlist": "what each source tracks, and when its baseline was seeded",
      "/reliability": "fleet totals, heal rate, mean recovery",
    },
  }),
);

// newly-appeared entities: in bug bounty the first submission wins, so this
// is the endpoint that matters. Only fed by runs the sentinel scored healthy.
app.get("/new", (c) => {
  const hours = Math.min(Number(c.req.query("hours") ?? 168), 24 * 90);
  const rows = db
    .prepare(
      `SELECT d.first_seen_at, d.entity_key, d.payload_json, s.domain, s.id AS source_id
       FROM discovery d JOIN source s ON s.id = d.source_id
       WHERE d.seeded = 0
         AND d.first_seen_at >= datetime('now', '-' || ? || ' hours')
       ORDER BY d.first_seen_at DESC LIMIT 300`,
    )
    .all(hours) as unknown as DiscoveryRow[];
  return c.json(
    rows.map((r) => ({
      first_seen_at: r.first_seen_at,
      source: r.domain,
      source_id: r.source_id,
      key: r.entity_key,
      entity: JSON.parse(r.payload_json),
    })),
  );
});

// what each source is currently tracking, and when its baseline was seeded
app.get("/watchlist", (c) => {
  const rows = db
    .prepare(
      `SELECT s.domain, s.id AS source_id, COUNT(*) AS tracked,
              SUM(CASE WHEN d.seeded = 0 THEN 1 ELSE 0 END) AS discovered_since_baseline,
              MIN(d.first_seen_at) AS baseline_at, MAX(d.first_seen_at) AS latest_at
       FROM discovery d JOIN source s ON s.id = d.source_id
       GROUP BY d.source_id ORDER BY tracked DESC`,
    )
    .all();
  return c.json(rows);
});

// leaderboard: highest-reward programs across every platform. Bug bounties
// pay the same everywhere, so the interesting vectors are reward size and
// recency, not geography. Pulls the latest verified rows and ranks by bounty.
app.get("/top", (c) => {
  const rows = db
    .prepare(
      `SELECT r.rows_json, s.domain FROM run r JOIN source s ON s.id = r.source_id
       WHERE r.verdict='healthy' AND s.status!='retired'
         AND r.started_at=(SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id=r.source_id AND r2.verdict='healthy')`,
    )
    .all() as unknown as LatestRunRow[];
  const out: Program[] = [];
  for (const r of rows) {
    const domain = platformOf(r.domain);
    for (const row of JSON.parse(r.rows_json ?? "[]") as Fields[]) {
      const name = programName(row);
      const bounty = num(maxBounty(row));
      if (name && bounty > 0) out.push({ program: name, bounty, platform: domain, category: row.category ?? row.activity_area ?? row.industryName ?? null });
    }
  }
  // one entry per program per platform — the same program can appear in
  // several rows of a run (regional variants, repeated cards)
  const best = new Map<string, Program>();
  for (const e of out) {
    const k = `${e.platform}::${String(e.program).toLowerCase().trim()}`;
    const prev = best.get(k);
    if (!prev || e.bounty > prev.bounty) best.set(k, e);
  }
  const ranked = [...best.values()].sort((a, b) => b.bounty - a.bounty);

  // One project can run several programs on the same platform (Starknet took
  // three of the top four), which buries every other platform. `per` keeps the
  // M highest from each so the board stays representative.
  const per = Number(c.req.query("per") ?? 0);
  if (per > 0) {
    const seen = new Map<string, number>();
    const balanced = ranked.filter((e) => {
      const n = seen.get(e.platform) ?? 0;
      if (n >= per) return false;
      seen.set(e.platform, n + 1);
      return true;
    });
    return c.json(balanced.slice(0, Number(c.req.query("limit") ?? 25)));
  }
  return c.json(ranked.slice(0, Number(c.req.query("limit") ?? 25)));
});

// the product's spine: programs newest-first with their reward.
// A row only qualifies if its date is real: either the platform published a
// launch date, or our watcher caught the program appearing after baseline
// (first_seen is then a true “when it showed up”). Baseline-seeded rows with
// no published date are excluded — their first_seen is just the day this
// database started watching, and ranking eToro as “new” because we seeded
// it yesterday would be fabrication.
app.get("/newest", (c) => {
  const limit = Math.min(Number(c.req.query("limit") ?? 40), 300);
  const rows = db
    .prepare(
      `SELECT d.first_seen_at, d.entity_key, d.payload_json, d.seeded, s.domain
       FROM discovery d JOIN source s ON s.id = d.source_id
       WHERE s.status != 'retired'`,
    )
    .all() as unknown as DiscoveryRow[];
  // Sanity-check published launch dates. Bug bounty platforms did not exist
  // before ~2012, so anything older is an extraction artefact, not history —
  // one collector returned 2001-05-19 for a program launched years later.
  // Reject the impossible rather than let it outrank real dates.
  const EPOCH = "2012-01-01";
  const plausible = (d: unknown) =>
    typeof d === "string" && d >= EPOCH && d <= new Date(Date.now() + 864e5).toISOString();
  const out = rows.flatMap((r) => {
    const e = JSON.parse(r.payload_json ?? "{}") as Fields;
    const launchedRaw = [e.started_at, e.listed_date].find(plausible);
    const launched = launchedRaw ? (launchedRaw as string) : null;
    if (!launched && r.seeded !== 0) return []; // no real date — not rankable
    return [{
      program: programName(e) ?? r.entity_key,
      bounty: num(maxBounty(e)),
      reward_text: e.reward_range ?? e.bounty_range ?? null,
      // when a platform publishes no reward, say what it does publish
      // rather than showing an empty cell
      access: e.participation ?? e.type ?? e.program_type ?? null,
      platform: platformOf(r.domain),
      category: e.category ?? e.activity_area ?? e.industryName ?? e.program_type ?? null,
      launched_at: launched,
      first_seen_at: r.first_seen_at,
      date: launched ?? r.first_seen_at,
      is_new: r.seeded === 0,
    }];
  });
  // Strictly newest-first on the date the row actually displays. Earlier
  // versions preferred genuine arrivals, then entries carrying a launch
  // date — which quietly overrode chronology and put Dec 2025 above
  // Aug 2026. A column showing a date must be sorted by that date.
  type Entry = (typeof out)[number];
  const stamp = (e: Entry) => new Date(String(e.date).replace(" ", "T")).getTime() || 0;
  const byRecency = (a: Entry, b: Entry) => stamp(b) - stamp(a);
  out.sort(byRecency);

  // One platform publishes far more launch dates than the rest, so a global
  // sort hands it the whole feed. `per` takes the N most recent from each
  // platform that has anything real to show — platforms with no dated rows
  // simply don't appear, which is the truth.
  const per = Number(c.req.query("per") ?? 0);
  if (per > 0) {
    const groups = new Map<string, Entry[]>();
    for (const e of out) {
      const g = groups.get(e.platform) ?? [];
      if (g.length < per) { g.push(e); groups.set(e.platform, g); }
    }
    const balanced = [...groups.values()].flat().sort(byRecency);
    return c.json(balanced.slice(0, limit));
  }
  return c.json(out.slice(0, limit));
});

// aggregate signals for the dashboard: the vectors that matter in bug
// bounty are reward size and recency, not geography.
app.get("/signals", (c) => {
  const rows = db
    .prepare(
      `SELECT r.rows_json, s.domain FROM run r JOIN source s ON s.id = r.source_id
       WHERE r.verdict='healthy' AND s.status!='retired'
         AND r.started_at=(SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id=r.source_id AND r2.verdict='healthy')`,
    )
    .all() as unknown as LatestRunRow[];
  const seen = new Set<string>();
  const bounties: number[] = [];
  const byPlatform: Record<string, number> = {};
  let paying = 0, total = 0;
  const accessMix: Record<string, number> = {};
  for (const r of rows) {
    const domain = platformOf(r.domain);
    for (const row of JSON.parse(r.rows_json ?? "[]") as Fields[]) {
      const name = programName(row);
      if (!name) continue;
      const k = `${domain}::${String(name).toLowerCase().trim()}`;
      if (seen.has(k)) continue;
      seen.add(k);
      total++;
      byPlatform[domain] = (byPlatform[domain] ?? 0) + 1;
      const b = num(maxBounty(row));
      if (b > 0) { bounties.push(b); paying++; }
      const acc = String(row.participation ?? row.type ?? row.program_type ?? "").toLowerCase();
      if (acc) {
        const key = acc.includes("invite") ? "invite-only"
          : acc.includes("vdp") || acc.includes("disclosure") ? "VDP (no bounty)"
          : "public bounty";
        accessMix[key] = (accessMix[key] ?? 0) + 1;
      }
    }
  }
  bounties.sort((a, b) => a - b);
  const newCount = (db.prepare(
    "SELECT COUNT(*) n FROM discovery WHERE seeded=0 AND first_seen_at >= datetime('now','-7 days')"
  ).get() as { n: number }).n;
  // reward tiers — where the money actually sits
  const tiers = [
    { label: "$10k+", min: 10000, max: Infinity },
    { label: "$1k–10k", min: 1000, max: 10000 },
    { label: "$100–1k", min: 100, max: 1000 },
    { label: "under $100", min: 0, max: 100 },
  ].map((t) => ({ label: t.label, count: bounties.filter((b) => b >= t.min && b < t.max).length }));
  const arrivals = db
    .prepare(
      `SELECT substr(first_seen_at,1,10) AS day, COUNT(*) AS n
       FROM discovery WHERE seeded=0 AND first_seen_at >= datetime('now','-14 days')
       GROUP BY day ORDER BY day DESC`,
    )
    .all();
  return c.json({
    total_programs: total,
    platforms: byPlatform,
    paying_programs: paying,
    top_bounty: bounties.length ? bounties[bounties.length - 1] : 0,
    median_bounty: bounties.length ? bounties[Math.floor(bounties.length / 2)] : 0,
    above_10k: bounties.filter((b) => b >= 10000).length,
    new_this_week: newCount,
    access: accessMix,
    tiers,
    arrivals_by_day: arrivals,
    total_rewards_pool: bounties.reduce((a, b) => a + b, 0),
  });
});

// the accumulated time series — the dataset's real value grows here
app.get("/history", (c) => {
  const sourceId = c.req.query("source");
  if (!sourceId) return c.json({ error: "pass ?source=N (see /sources)" }, 400);
  const rows = db
    .prepare(
      `SELECT started_at, country, verdict, row_count, rows_json
       FROM run WHERE source_id = ? AND verdict = 'healthy' AND rows_json IS NOT NULL
       ORDER BY started_at ASC LIMIT 500`,
    )
    .all(sourceId) as unknown as ExportRow[];
  return c.json(
    rows.map((r) => ({
      as_of: r.started_at,
      country: r.country,
      row_count: r.row_count,
      rows: JSON.parse(r.rows_json ?? "[]"),
    })),
  );
});

app.get("/sources", (c) => {
  const rows = db
    .prepare(
      `SELECT s.id, s.url, s.domain, s.collector_id, s.status,
              s.birth_certified_at, s.quarantined_at, s.contract_json,
              (SELECT verdict FROM run r WHERE r.source_id = s.id
               ORDER BY r.started_at DESC LIMIT 1) AS last_verdict
       FROM source s ORDER BY s.id`,
    )
    .all() as unknown as SourceRow[];
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
       WHERE s.status != 'retired'
       ORDER BY i.detected_at DESC LIMIT 100`,
    )
    .all() as unknown as IncidentRow[];
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
       WHERE r.verdict = 'healthy' AND s.status != 'retired' ${where}
         AND r.started_at = (
           SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id = r.source_id AND r2.country = r.country
             AND r2.verdict = 'healthy')
       ORDER BY r.source_id, r.country`,
    )
    .all(...(sourceId ? [sourceId] : [])) as unknown as ExportRow[];
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
       WHERE r.verdict = 'healthy' AND s.status != 'retired' ${where}
         AND r.started_at = (
           SELECT MAX(r2.started_at) FROM run r2
           WHERE r2.source_id = r.source_id AND r2.country = r.country
             AND r2.verdict = 'healthy')`,
    )
    .all(...(sourceId ? [sourceId] : [])) as unknown as ExportRow[];

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
       WHERE s.status != 'retired' AND g.probed_at = (
         SELECT MAX(g2.probed_at) FROM geo_probe g2
         WHERE g2.source_id = g.source_id AND g2.country = g.country)
       ORDER BY g.source_id, g.country`,
    )
    .all() as unknown as GeoRow[];
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
