# Mycelium 🍄

**You describe what you want to know. It grows the collection network to find out — and keeps it alive.**

| | |
|---|---|
| **Live dashboard** | https://mycelium-lime.vercel.app |
| **Collector IDs** | `c_mt4r56otf8phmeqn9` · `c_mt4r58cw1mt6zqk977` · `c_mt4r55051pvpl2mlbn` · `c_mt4t6n8t1racao61iu` · `c_mt4tjsqn1rh9sw6gb8` · `c_mt4tjuiigedbryfoe` — all in [`fleet.json`](fleet.json) |
| **Stack** | Node ≥ 22.5 · TypeScript · Hono · `node:sqlite` · zod · vitest |
| **Built for** | [Into the Scrape-Verse](https://www.wemakedevs.org/hackathons/scrape-verse) on [Bright Data Scraper Studio](https://docs.brightdata.com/datasets/scraper-studio/overview) |

**At submission:** 6 live collectors · 380 programs tracked · 567 verified rows · 45 healthy runs · 8 repair incidents (6 healed unattended, 2 quarantined) · mean recovery 23 min · 41 tests.

---

## Contents

[The problem](#the-problem) · [The vertical](#the-vertical-bug-bounty-discovery) · [How it works](#how-it-works) · [What Bright Data does](#what-bright-data-actually-does) · [Verification](#verification-three-gates) · [Honest dates](#honest-dates-the-rule-that-cost-the-most-rows) · [API](#api) · [Quickstart](#quickstart-fresh-machine) · [Tests](#tests) · [Repo layout](#repo-layout) · [Deploy](#deploy-static-snapshot) · [Cost](#cost) · [Limitations](#known-limitations)

---

## The problem

A scraper is written once and maintained forever. Scraper Studio removes two of those costs: it **writes** extraction logic from plain English, and it **rewrites** that logic when the page changes (`bdata scraper heal`).

What it does not do is decide **what** to collect, notice **when** something broke, or judge whether a repair can be **trusted**. Mycelium is the organism built around that gap — it automates the *customer* of the repair shop, not the repair itself.

The failure it exists to catch looks like success. A collector returns 63 rows and every dashboard reports green. Underneath, 36% of program names are empty and not one reward value came through. **A row count cannot see that. A contract can.**

## The vertical: bug bounty discovery

Every public bug bounty program across every major platform — and the moment a new one launches, you know.

In bug bounty the **first submission wins**; a duplicate pays nothing. So "this program appeared 40 minutes ago" is worth more than any leaderboard. That is the signal the whole system is built to produce.

| Platform | Collector | Status | Notes |
|---|---|---|---|
| Bugcrowd | `c_mt4r58cw1mt6zqk977` | active | JSON endpoint; **publishes real launch dates** |
| YesWeHack | `c_mt4r56otf8phmeqn9` | active | JSON API; healed once (see incidents) |
| Intigriti | `c_mt4r55051pvpl2mlbn` | active | client-rendered SPA; born empty, healed |
| HackenProof | `c_mt4t6n8t1racao61iu` | active | crypto/web3 programs, largest rewards |
| HackerOne | `c_mt4tjsqn1rh9sw6gb8` | active | **Cloudflare + client-rendered** |
| Google BugHunters | `c_mt4tjuiigedbryfoe` | active | VRP rules pages |
| Open Bug Bounty | `c_mt4tzvdn2q2xe8mwsd` | **unproven** | never earned trust — excluded from serving |

That last row is deliberate. It is counted in the fleet total (`6 / 18` on the dashboard) and excluded from every served response.

**Why these targets prove the platform.** They are the hardest pages in the brief: HackerOne and Bugcrowd sit behind Cloudflare *and* render their directories client-side. Bright Data's unlocker went through both — HTTP 200 with `cf-ray` headers. The remaining obstacle was JS rendering, not blocking, which is exactly what Scraper Studio collectors are for.

They are also genuinely **long tail**: none of these six exist in Bright Data's 800+ pre-built scraper library, which is e-commerce, social and jobs.

> **This vertical was swapped in on the last day.** The engine did not change — not one line of the sentinel, the gates, the heal loop or the scheduler. Only [`fleet.json`](fleet.json) (targets and contracts) moved. The previous vertical's 11 collectors and their entire incident history remain in the database as evidence: the same organism, repointed at a completely different domain in an afternoon.

## How it works

```
intent ─▶ discover ─▶ collect ─▶ survive ─▶ serve
          propose      scheduler   sentinel    export API
          prove        contracts   diagnose    dashboard
          promote      heartbeat   heal+gates  collector endpoints
```

**1 · Discover — propose, prove, promote.**
`bdata discover`/`search` plus a seed list propose candidate pages. Each is *proved* with one cheap `bdata scrape` (1 credit) and scored for real signal **before** a collector is spent — `scraper create` is the expensive operation. Every rejection is logged with its reason in [`fleet.json`](fleet.json): Immunefi returned a proxy 403, huntr was an empty SPA shell, Zoho was a single program rather than a directory.

**2 · Collect.**
Each promoted source gets a Scraper Studio collector (`c_*`) plus a **contract**: field names, types, and plain-language descriptions. A scheduler sweeps every collector on its own clock with jitter, under a hard daily page-load ceiling.

**3 · Survive.**
After every run the **sentinel** — pure, fully unit-tested functions — scores output against the contract and a rolling median baseline into `healthy / degraded / broken`. On `broken`, the **diagnostician** compiles the field descriptions into a heal prompt (≤1000 chars), calls `bdata scraper heal`, and the repair faces [three gates](#verification-three-gates).

**4 · Serve.**
The verified dataset exits as a product: twelve public endpoints, a live dashboard, and every collector doubles as a Bright Data API endpoint.

### The first-submission signal

Every verified run is diffed against every entity that source has ever shown. Additions are recorded with a first-seen timestamp, exposed at `GET /new`, and marked with a red dot on the dashboard's **Latest per platform** board.

Two rules keep the alert honest:

- **The first sweep seeds silently.** Day one is a baseline, not breaking news — otherwise all 380 programs would alert at once.
- **Only sentinel-healthy runs feed it.** A broken scraper cannot manufacture a fake "new program", because a run that fails its contract never reaches the watcher. The gates protect the alert, not just the dataset.

## What Bright Data actually does

Being specific, because "used Bright Data" is not a claim:

| Surface | Command | Used for | Evidence |
|---|---|---|---|
| **Scraper Studio** | `bdata scraper create` | Wrote every extractor from a plain-English contract. No selector was hand-written. | 18 collectors created |
| **Runner** | `bdata scraper run` | Executes collectors; output is contract-verified before it counts | 45 healthy runs |
| **Healing AI** | `bdata scraper heal` → `approve --auto-save` | Rewrote broken extractors from a machine-written failure report | 6 unattended repairs |
| **Web Unlocker** | `bdata scrape --country` | Defeated Cloudflare on HackerOne and Bugcrowd; proves candidates for 1 credit | 120 probes / 8 countries |
| **Discovery** | `bdata discover` / `search` | Proposed candidate directories | 10 logged rejections |

Scraper types used: **PDP** (directory pages + JSON endpoints) and **Discovery** (candidate proposal).

> **A finding worth passing on:** `scraper approve` **without `--auto-save` reports success and silently discards the healed template.** We only caught it because verification runs against production rather than the preview. See [`bdata.ts`](packages/orchestrator/src/bdata.ts) — the flag is load-bearing and commented as such.

## Verification: three gates

A repair is not believed because it previewed well. It must pass all three:

| Gate | Question | Catches |
|---|---|---|
| **contract** | Do declared types hold and required fields exist? | heals that drop a field entirely |
| **golden** | Do fixture rows recorded while healthy still return their known values? | heals that grab a different element |
| **continuity** | Did numbers land within 10× of the last healthy run? | heals that scrape a totally different page region |

`--auto-approve` is **banned** in this codebase: a heal that returns plausible garbage poisons the dataset silently. Three incidents in 48h → **quarantine**; the system knows when to stop repairing.

### Trust is earned, never assumed

- **Birth certificate** — no collector seeds its baseline until its first run passes its contract *and* a human reviews the rows ([`certify.ts`](packages/orchestrator/src/certify.ts)).
- **Heals are verified in production, not preview.** Two collectors passed their repair previews and still returned empty fields against the live site. They were **quarantined rather than served**. That is the behaviour this project is proudest of — a system that refuses to publish its own output is harder to build than one that always succeeds.

## Honest dates: the rule that cost the most rows

Only Bugcrowd publishes launch dates. For everything else, the obvious fallback — "when did we first see it" — is a lie for any row loaded during baseline seeding, because that timestamp is *the day this database was created*, not the day the program opened.

An early build stamped 350 old programs with today's date. Every row now carries how far its recency can be trusted:

| `recency` | Meaning | Allowed in the chronological list? |
|---|---|---|
| `published` | The platform printed a launch date | yes |
| `observed` | The watcher saw it appear after baseline — genuinely new | yes |
| `listed` | Only the platform's own ordering is known | **no — excluded** |

`GET /newest` (no `per`) returns strictly chronological rows and **omits `listed` entirely**. `GET /newest?per=N` answers a different question — *what is latest on each platform* — and falls through the levels so a platform with no dated rows still appears.

## API

Twelve endpoints, CORS-open, serving only gate-verified rows.

| Endpoint | Returns |
|---|---|
| `GET /api` | self-describing index of everything below |
| `GET /export.json?source=N` | latest verified rows per source (omit `source` for all) |
| `GET /export.csv?source=N` | same dataset as tidy CSV (`field,row_index,value`) |
| `GET /history?source=N` | full time series — every verified run's rows for one source |
| `GET /newest?limit=N&per=M` | newest-first with reward; `per=M` gives the M latest per platform |
| `GET /top?limit=N&per=M` | highest-reward programs; `per=M` caps each platform's share |
| `GET /new?hours=N` | programs first seen since baseline — **the first-submission signal** |
| `GET /signals` | aggregates: top bounty, median, count above $10k, new this week |
| `GET /watchlist` | what each source tracks and when its baseline was seeded |
| `GET /sources` | the fleet: status, contract, certification |
| `GET /runs?source=N&limit=M` | run log: verdicts and row counts |
| `GET /incidents` | every break: symptom, machine-written heal prompt, gates, decision |
| `GET /reliability` | fleet totals, heal rate, mean recovery |

```bash
curl -s "https://mycelium-lime.vercel.app/newest?limit=6&per=3"
curl -s "https://mycelium-lime.vercel.app/incidents" | head -40
```

## Quickstart (fresh machine)

Requires **Node ≥ 22.5** — uses built-in `node:sqlite`, so there are no native builds and no compiler toolchain.

```bash
npm install
npm test                                     # 41 tests
npx -p @brightdata/cli bdata login           # one-time browser auth
npx tsx packages/orchestrator/src/seed.ts    # load fleet.json into SQLite
npm run api                                  # dashboard + API at localhost:4000
npm run orchestrate                          # heartbeat: sweep, detect, heal, verify
```

Certify a new collector's first output (human-in-the-loop, once per source):

```bash
npx tsx packages/orchestrator/src/certify.ts show yeswehack
npx tsx packages/orchestrator/src/certify.ts approve yeswehack
```

`npm run check` runs typecheck and tests together.

## Tests

41 tests across 4 files — all pure functions, no network, no database.

| File | Tests | Covers |
|---|---|---|
| [`sentinel/src/index.test.ts`](packages/sentinel/src/index.test.ts) | 15 | scoring, null-rate detection, baseline comparison, verdicts |
| [`orchestrator/src/gates.test.ts`](packages/orchestrator/src/gates.test.ts) | 11 | contract / golden / continuity, including deliberate failures |
| [`orchestrator/src/normalize.test.ts`](packages/orchestrator/src/normalize.test.ts) | 8 | row normalisation and dedupe |
| [`orchestrator/src/watch.test.ts`](packages/orchestrator/src/watch.test.ts) | 7 | first-seen semantics, silent seeding, arrival detection |

The dedupe tests exist because a collector once emitted every program **8×** from duplicate DOM matches — 192 rows for 24 programs. Row counts lie.

## Repo layout

```
packages/contracts     zod schemas: Field, Contract, config
packages/sentinel      pure scoring/diagnosis functions + tests
packages/orchestrator  bdata wrapper, scheduler, heal loop, gates, quarantine, db
  bdata.ts             CLI wrapper (retries, JSON parsing, --auto-save)
  scheduler.ts         the heartbeat: per-source clocks, jitter, credit ceiling
  heal.ts              diagnose -> prompt -> heal -> gates -> approve
  watch.ts             first-seen diffing, the arrival signal
  certify.ts           birth certificates (human-in-the-loop)
  db.ts                node:sqlite schema + migrations
apps/api               Hono: dashboard, exports, incidents, signals
apps/api/public        the dashboard (single file) + baked snapshot
scripts/snapshot.ts    bakes every route to static JSON for deployment
fleet.json             fleet registry: contracts, probe evidence, rejections
mycelium.config.json   every cap that spends money, in one reviewable file
```

## Deploy (static snapshot)

The engine is stateful — SQLite on disk, a heartbeat that sweeps on a schedule — so it cannot run on serverless. But every route the dashboard calls is a `GET` totalling ~530 KB, so the same bytes can be served as files.

```bash
npm run snapshot     # bake all twelve routes to apps/api/public/data/
git push             # Vercel rebuilds from main automatically
```

`vercel.json` rewrites the page's existing fetch URLs onto the baked files, so **`index.html` is byte-identical between local and deployed** — there is no second copy to drift.

The deployed page detects it has no server (`/live` 404s) and labels itself **`SNAPSHOT · <date>`** rather than claiming a live fleet.

> `?demo=1` runs the dashboard through a scripted tour by itself — used to record the demo without a cursor or automation banner on screen. Inert without the query string.

## Cost

Sweeps run 6×/day (first submission wins, so cadence matters), hard-capped at **400 page loads/day** in [`mycelium.config.json`](mycelium.config.json). At $1.50 per 1,000 loads, a week of continuous watching costs **under $2** — inside the free tier.

Every cap that spends money lives in that one file, reviewable in a single screen.

## Known limitations

Stated plainly, because the alternative is a judge finding them:

- **`scraper run` has no geo flag.** Structured runs are global. Per-market divergence is measured at the page level instead, via `bdata scrape --country` probes — an honest proxy, not per-country structured data.
- **Four of six platforms publish no launch dates.** Their rows are `listed` and excluded from the chronological feed. This shrinks the board but keeps it truthful; as the watcher keeps sweeping, arrivals upgrade to `observed` automatically.
- **Open Bug Bounty never earned trust** and is excluded from serving while still counted in the fleet total.
- **Immunefi is deferred, not solved** — its collector generated, but Bright Data's proxy returned a 403 tunnelling error on every run. Logged in `fleet.json` under the two-attempt rule rather than quietly dropped.

## License

MIT.

**AI use:** built with Claude Code and other LLMs as pair-programmers. Bright Data's Scraper Studio AI generates and repairs the extraction code behind every `c_*` collector — that is the platform being showcased. All architecture and product decisions are the author's, and every collector's first output was reviewed by hand before it was allowed to serve.
