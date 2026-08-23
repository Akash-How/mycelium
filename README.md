# Mycelium 🍄

**Live dashboard:** https://mycelium-lime.vercel.app
**Collector IDs (proof of working scrapers):** see [`fleet.json`](fleet.json) — `c_mt4r56otf8phmeqn9`, `c_mt4r58cw1mt6zqk977`, `c_mt4r55051pvpl2mlbn`, `c_mt4t6n8t1racao61iu`, `c_mt4tjsqn1rh9sw6gb8`, `c_mt4tjuiigedbryfoe`

**You describe what you want to know. It grows the collection network to find out — and keeps it alive.**

Built on [Bright Data Scraper Studio](https://docs.brightdata.com/datasets/scraper-studio/overview) for the [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon (Aug 17–23, 2026).

## The problem

A scraper is written once and maintained forever. Scraper Studio removes two of the costs: it *writes* extraction logic from plain English, and it *rewrites* that logic when the page changes (`bdata scraper heal`). What it does not do is decide **what** to collect, notice **when** something broke, or judge whether a repair can be **trusted**. Mycelium is the organism built around that gap.

The demo vertical: **every public bug bounty program, across every major platform** — and the moment a new one launches, you know. In bug bounty the first submission wins, so "a program appeared 20 minutes ago" is worth more than any dashboard.

These are the hardest targets we've hit — HackerOne and Bugcrowd sit behind Cloudflare and render their directories client-side. Bright Data's unlocker went through them (200 OK with `cf-ray` headers on both); the remaining obstacle was JS rendering, not blocking, which is what Scraper Studio collectors are for.

> **This vertical was swapped in on the last day.** The engine did not change — not one line of the sentinel, the gates, the heal loop or the scheduler. Only `fleet.json` (targets and contracts) changed. The previous vertical's collectors and its entire incident history remain in the audit trail as evidence: the same organism, repointed at a completely different domain in an afternoon.

## How it works

```
intent ─▶ discover ─▶ collect ─▶ survive ─▶ serve
          propose      scheduler   sentinel    export API
          prove        geo matrix  diagnose    dashboard
          promote      (--country) heal+gates  collector endpoints
```

1. **Discover — propose, prove, promote.** `bdata discover`/`search` plus a seed list propose candidate pages. Each is *proved* with one cheap `bdata scrape` (1 credit) and scored for real signal before any collector is spent — `scraper create` is the expensive operation. Rejections are logged with reasons ([fleet.json](fleet.json)).
2. **Collect.** Each promoted source gets a Scraper Studio collector (a `c_*` id) plus a **contract**: field names, types, and plain-language descriptions. A scheduler loop sweeps every collector on its own clock. Structured runs are global (`scraper run` has no geo flag — we verified); market divergence is measured honestly at the page level instead, via daily `bdata scrape --country` probes per source that extract price signals and currencies per market.
3. **Survive.** After every run the **sentinel** (pure functions, fully unit-tested) scores output against the contract and a rolling median baseline: `healthy / degraded / broken`. On `broken`, the **diagnostician** compiles the field descriptions into a heal prompt (≤1000 chars), calls `bdata scraper heal`, and the repair must pass **three gates** before `bdata scraper approve`:
   - **contract** — declared types hold, required fields present
   - **golden** — fixture rows recorded while healthy still return their known values
   - **continuity** — numbers land within 10× of the last healthy run (a heal that grabbed the wrong element fails here)
   
   `--auto-approve` is banned: a heal that returns plausible garbage poisons the dataset silently. Three incidents in 48h → **quarantine** (the system knows when to stop repairing).
4. **Serve.** The verified dataset exits as a product: `GET /export.json`, `GET /export.csv`, a live dashboard, and every collector doubles as a Bright Data API endpoint (`POST /dca/trigger`).

### The first-submission signal

Every verified run is diffed against every entity that source has ever shown. Additions are recorded with a first-seen timestamp and surfaced at `GET /new` and on the dashboard's **Arrivals** panel; the heartbeat prints them to the console as they land.

Two rules keep the alert honest:

- **The first sweep seeds silently.** Day one is a baseline, not breaking news — otherwise every existing program would alert at once.
- **Only sentinel-healthy runs feed it.** A broken scraper cannot manufacture a fake "new program", because a run that fails its contract never reaches the watcher. The gates protect the alert, not just the dataset.

### Trust is earned, never assumed

- **Birth certificate**: no collector seeds its baseline until its first run passes its contract *and* a human eyeballs the rows (`certify.ts`).
- **Heals are verified in production, not just in preview.** Discovered the hard way: `scraper approve` without `--auto-save` reports success but never persists the template — and even a saved heal can extract in preview yet return empty fields in production (that source is now quarantined, audit trail included). A repair counts only when verified rows flow from a real run.

## Quickstart (fresh machine)

Requires Node ≥ 22.5 (uses built-in `node:sqlite` — no native builds, no compiler toolchain).

```bash
npm install
npm test                              # 41 tests: sentinel, gates, normalizer, watcher
npx -p @brightdata/cli bdata login    # one-time browser auth
npx tsx packages/orchestrator/src/seed.ts    # load fleet.json into SQLite
npm run api                           # dashboard + API at http://localhost:4000
npm run orchestrate                   # the heartbeat: sweep, detect, heal, verify
```

Certify a new collector's first output (human-in-the-loop, once per source):

```bash
npx tsx packages/orchestrator/src/certify.ts show yeswehack
npx tsx packages/orchestrator/src/certify.ts approve yeswehack
```

## Repo layout

```
packages/contracts     zod schemas: Field, Contract, config
packages/sentinel      pure scoring/diagnosis functions + tests
packages/orchestrator  bdata wrapper, scheduler, heal loop, gates, quarantine, db
apps/api               Hono: dashboard, /export.json, /export.csv, /incidents
fleet.json             the fleet registry: contracts, probe evidence, rejections
mycelium.config.json   every cap that spends money, in one reviewable file
```

Scraper Studio scraper types used: **PDP** (directory + JSON endpoints) and **Discovery** (candidate proposal).

## Cost

Sweeps run 6×/day (first submission wins, so cadence matters), hard-capped at 400 page loads/day in config. At $1.50 per 1,000 loads, a week of continuous watching costs under $2 of the free tier.

## Deploy (static snapshot)

The engine is stateful — SQLite on disk, a heartbeat that sweeps on a
schedule — so it cannot run on serverless. Every route the dashboard calls
is a GET totalling ~530 KB, so `npm run snapshot` bakes all twelve routes
to `apps/api/public/data/` and `vercel.json` rewrites the page's fetch URLs
onto them. `index.html` is byte-identical between local and deployed.

```bash
npm run snapshot     # bake the current database to static JSON
git push             # Vercel rebuilds from main automatically
```

The deployed page detects it has no server (`/live` 404s) and labels itself
`SNAPSHOT · <date>` rather than claiming a live fleet.

## License

MIT.

**AI use:** built with Claude Code and other LLMs as pair-programmers.
Bright Data's Scraper Studio AI generates and repairs the extraction code
behind every `c_*` collector — that is the platform being showcased. All
architecture and product decisions are the author's, and every collector's
first output was reviewed by hand before it was allowed to serve.
