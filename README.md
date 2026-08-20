# Mycelium 🍄

**You describe what you want to know. It grows the collection network to find out — and keeps it alive.**

Built on [Bright Data Scraper Studio](https://docs.brightdata.com/datasets/scraper-studio/overview) for the [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) hackathon (Aug 17–23, 2026).

## The problem

A scraper is written once and maintained forever. Scraper Studio removes two of the costs: it *writes* extraction logic from plain English, and it *rewrites* that logic when the page changes (`bdata scraper heal`). What it does not do is decide **what** to collect, notice **when** something broke, or judge whether a repair can be **trusted**. Mycelium is the organism built around that gap.

The demo vertical: **what AI APIs, GPU clouds and developer platforms actually cost** — long-tail pricing pages that Bright Data's pre-built library doesn't cover — with per-market divergence probes across 8 countries.

## How it works

```
intent ─▶ discover ─▶ collect ─▶ survive ─▶ serve
          propose      scheduler   sentinel    export API
          prove        geo matrix  diagnose    dashboard
          promote      (--country) heal+gates  collector endpoints
```

1. **Discover — propose, prove, promote.** `bdata discover`/`search` plus a seed list propose candidate pages. Each is *proved* with one cheap `bdata scrape` (1 credit) and scored for price signals before any collector is spent — `scraper create` is the expensive operation. Rejections are logged with reasons ([fleet.json](fleet.json)).
2. **Collect.** Each promoted source gets a Scraper Studio collector (a `c_*` id) plus a **contract**: field names, types, and plain-language descriptions. A scheduler loop sweeps every collector on its own clock. Structured runs are global (`scraper run` has no geo flag — we verified); market divergence is measured honestly at the page level instead, via daily `bdata scrape --country` probes per source that extract price signals and currencies per market.
3. **Survive.** After every run the **sentinel** (pure functions, fully unit-tested) scores output against the contract and a rolling median baseline: `healthy / degraded / broken`. On `broken`, the **diagnostician** compiles the field descriptions into a heal prompt (≤1000 chars), calls `bdata scraper heal`, and the repair must pass **three gates** before `bdata scraper approve`:
   - **contract** — declared types hold, required fields present
   - **golden** — fixture rows recorded while healthy still return their known values
   - **continuity** — numbers land within 10× of the last healthy run (a heal that grabbed the wrong element fails here)
   
   `--auto-approve` is banned: a heal that returns plausible garbage poisons the dataset silently. Three incidents in 48h → **quarantine** (the system knows when to stop repairing).
4. **Serve.** The verified dataset exits as a product: `GET /export.json`, `GET /export.csv`, a live dashboard, and every collector doubles as a Bright Data API endpoint (`POST /dca/trigger`).

### Trust is earned, never assumed

- **Birth certificate**: no collector seeds its baseline until its first run passes its contract *and* a human eyeballs the rows (`certify.ts`).
- **Heals are verified in production, not just in preview.** Discovered the hard way: `scraper approve` without `--auto-save` reports success but never persists the template — and even a saved heal can extract in preview yet return empty fields in production (that source is now quarantined, audit trail included). A repair counts only when verified rows flow from a real run.

## Quickstart (fresh machine)

Requires Node ≥ 22.5 (uses built-in `node:sqlite` — no native builds, no compiler toolchain).

```bash
npm install
npm test                              # 31 tests, sentinel + gates + normalizer
npx -p @brightdata/cli bdata login    # one-time browser auth
npx tsx packages/orchestrator/src/seed.ts    # load fleet.json into SQLite
npm run api                           # dashboard + API at http://localhost:4000
npm run orchestrate                   # the heartbeat: sweep, detect, heal, verify
```

Certify a new collector's first output (human-in-the-loop, once per source):

```bash
npx tsx packages/orchestrator/src/certify.ts show deepinfra
npx tsx packages/orchestrator/src/certify.ts approve deepinfra
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

Scraper Studio scraper types used: **PDP** (single pricing pages) and **Discovery** (candidate proposal).

## Cost

`4–6 collectors × 3 sweeps/day + 8-country geo probes × 1/day ≈ 60–70 page loads/day`, hard-capped at 400/day in config. At $1.50 per 1,000 loads the entire hackathon week costs well under $1 of the free tier.

## License

MIT. AI-use disclosure in [DISCLOSURE.md](DISCLOSURE.md).
