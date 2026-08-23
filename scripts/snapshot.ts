/**
 * Bakes every read endpoint to a static file so the dashboard can be served
 * without a Node process or a database.
 *
 * The engine is stateful — SQLite on disk, a heartbeat that sweeps on a
 * schedule — and none of that survives on serverless hosting. But everything
 * the page asks for is a GET, and the whole dataset is well under a megabyte,
 * so a snapshot serves the same bytes the live API would have.
 *
 * Run locally, where the database actually lives, and commit the result:
 *   npm run snapshot
 */
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { app } from "../apps/api/src/main.ts";

const OUT = join(process.cwd(), "apps", "api", "public", "data");

// The query strings matter: these are the exact URLs index.html requests, and
// the baked file has to hold the response for those parameters.
const ROUTES: Array<[url: string, file: string]> = [
  ["/api", "api.json"],
  ["/sources", "sources.json"],
  ["/runs?limit=200", "runs.json"],
  ["/incidents", "incidents.json"],
  ["/signals", "signals.json"],
  ["/top?limit=12&per=2", "top.json"],
  ["/newest?limit=18&per=3", "newest.json"],
  ["/reliability", "reliability.json"],
  ["/watchlist", "watchlist.json"],
  ["/new?hours=720", "new.json"],
  ["/export.json", "export.json"],
  ["/export.csv", "export.csv"],
];

async function main() {
  mkdirSync(OUT, { recursive: true });

  let total = 0;
  for (const [url, file] of ROUTES) {
    const res = await app.request(url);
    if (!res.ok) throw new Error(`${url} returned ${res.status} — refusing to bake a broken snapshot`);
    const body = await res.text();
    writeFileSync(join(OUT, file), body);
    total += body.length;
    console.log(`[snapshot] ${file.padEnd(16)} ${String(body.length).padStart(7)} B  <- ${url}`);
  }

  // The page reads this to label itself honestly: served from a snapshot taken
  // at a known moment, not a live fleet.
  const meta = { generated_at: new Date().toISOString(), routes: ROUTES.length, bytes: total };
  writeFileSync(join(OUT, "meta.json"), JSON.stringify(meta, null, 2));
  console.log(`[snapshot] ${ROUTES.length} routes, ${(total / 1024).toFixed(0)} KB, taken ${meta.generated_at}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
