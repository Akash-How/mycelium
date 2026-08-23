# Submission form — ready to paste

**Project name:** Mycelium

**One-liner:** A self-healing bug bounty radar: it watches every major
platform, repairs its own scrapers when the sites change, and tells you
the moment a new program launches — because the first submission wins.

**Repository:** https://github.com/Akash-How/mycelium

**Live dashboard:** https://mycelium-lime.vercel.app

**Demo video:** _(add YouTube unlisted link after recording)_

**Description (long):**

Scrapers break quietly — that's the problem this hackathon names, and
Bright Data's `scraper heal` repairs them from a plain-language prompt.
But someone still has to notice the break, write that prompt, and decide
whether to trust the fix. Mycelium automates the customer, not just the
repair shop.

Every source carries a machine-readable contract (fields, types,
plain-language descriptions). A scheduler sweeps each Scraper Studio
collector; a sentinel scores every run against the contract and a rolling
baseline. On breakage, a diagnostician compiles the contract into a heal
prompt (≤1000 chars) and calls `bdata scraper heal`. The repair must pass
three gates — contract, golden fixtures, continuity — before
`scraper approve --auto-save`; repeated failures quarantine the source.

**The vertical: bug bounty program discovery.** In bug bounty the first
submission wins, so the valuable signal isn't "this data changed" but
"something appeared that was never here before". Every verified run is
diffed against every program that platform has ever shown; arrivals are
stamped, exposed at `GET /new`, and surfaced on the dashboard's Arrivals
panel. Two rules keep the alert honest: the first sweep seeds silently
(day one isn't news), and only sentinel-healthy runs can raise an alert —
so a broken scraper can never manufacture a fake "new program".

Certified at submission: **six platforms** — Bugcrowd, YesWeHack,
Intigriti, HackenProof, HackerOne and Google BugHunters — **380 programs
under continuous watch, 567 verified rows serving.**

**Why these targets prove the platform:** bug bounty directories are the
hardest pages we hit. HackerOne and Bugcrowd sit behind Cloudflare and
render client-side. Bright Data's unlocker went through both (HTTP 200
with `cf-ray` headers); Bugcrowd handed over clean JSON. HackerOne's
directory needs a GraphQL POST, which `scrape` (GET-only) cannot reach —
recorded in fleet.json as a deferral, not a block.

**Everything in the audit trail is real.** Intigriti was born empty and
healed. YesWeHack was born with broken field mapping — 36% of titles
missing, bounty values never populated — the sentinel caught it and the
heal fixed it to 98%/95%. The watcher surfaced a duplication bug where a
collector emitted every program 8× (192 rows, 24 programs), now deduped
with tests. Earlier in the week, on a different vertical, the engine
earned 4 unattended heals (mean recovery 27 min) and 2 evidence-based
quarantines — including one where heals passed preview but returned empty
fields in production, which verification caught and benched.

**The pivot is the proof.** This vertical was swapped in on the final day.
The engine did not change — not one line of the sentinel, the gates, the
heal loop or the scheduler. Only `fleet.json` (targets and contracts)
moved. The retired vertical's collectors and complete incident history
remain in the database as evidence the organism is domain-agnostic.

We also discovered and documented that `scraper approve` without
`--auto-save` reports success while silently discarding the healed
template — caught only because we verify against production, not previews.

**How Scraper Studio is used (explicit):**
- `bdata scraper create` builds every collector from a plain-language
  description (collector IDs in fleet.json)
- `bdata scraper run` executes them; output is contract-verified
- `bdata scraper heal` + `approve --auto-save` repairs them — driven
  entirely by machine-written prompts
- `bdata scrape` (unlocker) proves every candidate for 1 credit before a
  collector is spent, and defeated Cloudflare on the hard targets
- `bdata discover`/`search` propose candidates
- Scraper types used: **PDP** (directory pages + JSON endpoints) and
  **Discovery** (candidate proposal)

**Tracks:** Web-Slinger (Best Use of Bright Data) · Suit-Up (Best UI) ·
Spider-Sense (Best Clean Code)

**Team:** Akash Mohan (solo)

**AI disclosure:** Built with Claude Code as pair-programmer; Scraper
Studio AI generates/repairs extraction code. Full disclosure in
DISCLOSURE.md.
