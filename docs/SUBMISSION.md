# Submission form — ready to paste

**Project name:** Mycelium

**One-liner:** A self-healing web data network: it builds its own
scrapers, detects its own breakages, writes its own repair orders, and
refuses to serve data it can't verify.

**Repository:** https://github.com/Akash-How/mycelium

**Demo video:** _(add YouTube unlisted link after recording)_

**Description (long):**

Scrapers break quietly — that's the problem this hackathon names, and
Bright Data's `scraper heal` repairs them from a plain-language prompt.
But someone still has to notice the break, write that prompt, and
decide whether to trust the fix. Mycelium automates the customer, not
just the repair shop.

Every source carries a machine-readable contract (fields, types,
plain-language descriptions). A scheduler sweeps each Scraper Studio
collector; a sentinel scores every run against the contract and a
rolling baseline. On breakage, a diagnostician compiles the contract
into a heal prompt (≤1000 chars) and calls `bdata scraper heal`. The
repair must pass three gates — contract, golden fixtures, continuity —
before `scraper approve --auto-save`; two failed repairs in a window
quarantines the source. The verified dataset ships as a live API
(`/export.json`, `/export.csv`) and a real-time dashboard.

Demo vertical: AI infrastructure pricing (deepinfra, together.ai,
novita, fireworks, lambda, railway) — long-tail pages not covered by
the pre-built library, probed from 8 countries for market divergence.

Everything in the audit trail happened for real during the event:
5 of 8 collectors were born broken; 5 incidents, 4 unattended heals
(mean recovery 27 min), and 2 evidence-based quarantines — including
one where heals passed preview but returned empty fields in
production, which our verification caught and benched. We also
discovered and documented that `scraper approve` without `--auto-save`
silently discards the healed template.

**How Scraper Studio is used (explicit):**
- `bdata scraper create` builds every collector from a plain-language
  description (8 created during the event; IDs in fleet.json)
- `bdata scraper run` executes them; output is contract-verified
- `bdata scraper heal` + `approve --auto-save` repairs them — driven
  entirely by machine-written prompts
- `bdata scrape --country` powers the 8-market divergence probes
- `bdata discover`/`search` propose candidates; every candidate is
  proved with a 1-credit scrape before a collector is spent
- Scraper types used: PDP + Discovery

**Tracks:** Web-Slinger (Best Use of Bright Data) · Suit-Up (Best UI) ·
Spider-Sense (Best Clean Code)

**Team:** Akash Mohan (solo)

**AI disclosure:** Built with Claude Code as pair-programmer; Scraper
Studio AI generates/repairs extraction code. Full disclosure in
DISCLOSURE.md.
