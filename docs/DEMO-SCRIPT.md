# Demo video — shot-by-shot script (~4 min)

Record at 1920×1080. The judging rubric wants four things explained:
**the problem, the scraper workflow, the structured output, the final
product.** This script hits them in that order.

## Pre-flight (before hitting record)

```bash
npm run api          # dashboard on :4000
npm run orchestrate  # heartbeat, separate terminal
curl http://localhost:4000/reliability
```

Hard-refresh once (Ctrl+Shift+R) and let the page fully settle — the
board, fleet and incident rows load over the network. All green? Record.

> Record on **localhost**, not the deployed URL. Local runs the real Node
> API and labels itself LIVE; the Vercel build is a static snapshot and
> says so. Mention the live link at the end instead.

---

## 0:00 — The problem (hero)

**Screen:** the hero. Scroll slowly so EVERY / MINUTE / COUNTS staircases
apart over the network graph.

**Say:** "In bug bounty, the first submission wins. Everything else is a
duplicate. I lost a five-thousand-dollar bounty to an hour — the program
opened that morning, I found it that night, and someone had already filed
the same bug. This is Mycelium. It watches every platform, repairs its own
scrapers when those sites change, and tells me the moment a program lands."

## 0:35 — The product (Live board)

**Screen:** the dashboard. Point at the five tiles, then the two columns.

**Say:** "380 programs across six platforms, 567 verified rows. Latest
from each platform on the left, highest rewards on the right. The red dot
marks a program the watcher caught appearing after baseline — that's a
genuine arrival, not a row I happened to scrape today."

## 1:05 — The scraper workflow (Sources, open a row)

**Screen:** click **bugcrowd.com** open — contract, run log, extraction.

**Say:** "Six Scraper Studio collectors, each one generated from a
plain-language contract — the fields it promises, described in English.
That description isn't documentation. It's the ammunition for repairs.
Here's the collector ID, and here's its latest verified extraction."

## 1:40 — The star beat (Self-healing)

**Screen:** open the **yeswehack** incident; walk the three columns.

**Say:** "This collector looked healthy — 63 rows. But the sentinel scored
it against its contract and caught what a row count hides: 36% of program
titles empty, bounty values never populated. Column two — the diagnostician
compiled that into a repair prompt and sent it to Bright Data's healing
AI. One machine writing a bug report to another. Column three — three
gates before we believe it. After the heal: titles 98%, bounty 95%."

Then open **intigriti**: "This one was born completely empty. Same loop,
no human."

## 2:25 — Refusing to trust (filter to Quarantined)

**Say:** "And here's the part I'm proudest of. These sources passed their
repair previews and still returned garbage in production, so the system
benched them instead of serving it. A wrong result served confidently is
worse than no result. Auto-approve is banned in this codebase."

## 2:55 — Cloudflare + structured output (terminal)

```bash
curl -s "http://localhost:4000/newest?limit=6&per=3" | head -30
curl -s "http://localhost:4000/export.json" | head -20
```

**Say:** "These are the hardest pages we scrape — Cloudflare in front,
client-rendered behind. Bright Data's unlocker went straight through:
HTTP 200 with cf-ray headers on both HackerOne and Bugcrowd. Everything
the dashboard shows is twelve public endpoints, CORS-open, serving only
gate-verified rows."

## 3:25 — Why it exists (story section)

**Screen:** scroll to the portrait; let the dither develop.

**Say:** "Behind that lost report was a week of research, a working proof
of concept, and nights I didn't sleep. The reply was one word. Duplicate."

## 3:45 — Close (finale)

**Screen:** the MYCELIUM ASCII wordmark. Click it once — it burns red.

**Say:** "One more thing: this entire vertical was swapped in on the last
day. The engine didn't change — not one line of the sentinel, the gates,
or the heal loop. Only the target list. I didn't write a scraper. I wrote
the thing that keeps scrapers honest. Live at mycelium-lime.vercel.app,
code at github.com/Akash-How/mycelium."

---

## Notes

- The heal loop is already history — the incident timeline **is** the
  footage. Nothing needs to break live on camera.
- Mask any tokens if a terminal shows them. `bdata` output can include
  account context — check before publishing.
- If the live page misbehaves, record each section separately and cut.
- Numbers drift as the heartbeat sweeps. Re-read them off the screen on
  the day rather than trusting the ones written here.
