# Demo video — shot-by-shot script (~4 min)

Record at 1920×1080, dashboard at http://localhost:4000, terminal ready.

## Pre-flight (before hitting record)

```bash
npm run api          # dashboard on :4000
npm run orchestrate  # heartbeat, separate terminal
curl http://localhost:4000/reliability
```

Hard-refresh the page once (Ctrl+Shift+R). All green? Record.

---

## 0:00 — The hook (hero)

**Screen:** the hero. Scroll slowly so PAGES / INTO / PROOF staircases
out over the particle network.

**Say:** "In bug bounty, the first submission wins. So hunters refresh
platform directories by hand, hoping to catch a new program early. This
is Mycelium — it watches every platform for you, repairs its own scrapers
when those sites change, and tells you the moment something new lands."

## 0:30 — Arrivals (scroll to Arrivals)

**Screen:** the Arrivals panel; the tracked count in the header.

**Say:** "266 programs across three platforms, under continuous watch.
Every verified sweep gets diffed against everything each platform has
ever shown. When a program appears that wasn't there before, it lands
here with a timestamp — and in the console the second it happens."

## 1:00 — The fleet (scroll to Network, click a row)

**Screen:** click **bugcrowd.com** open — contract, run log, extraction.

**Say:** "Three Scraper Studio collectors. Each carries a contract: the
fields it promises, in plain language. That description isn't
documentation — it's the ammunition for repairs. Watch."

## 1:30 — The star beat (scroll to The Loop)

**Screen:** open the **yeswehack** incident; walk the three columns.

**Say:** "This collector looked healthy — it returned 63 rows. But the
sentinel scored it against its contract and caught what a row count
hides: 36% of program titles were empty and bounty values were never
populated. Column two — the diagnostician compiled that failure into
this repair prompt and sent it to Bright Data's healing AI. One machine
writing a bug report to another. Column three — three gates before we
believe it. After the heal: titles 98%, bounty values 95%."

Then open **intigriti**: "This one was born completely empty. Same loop,
no human."

## 2:30 — Refusing to trust (filter to Quarantined)

**Screen:** click the **Quarantined** filter.

**Say:** "And here's what matters more. These sources passed their repair
previews — and still returned garbage in production. So the system
benched them instead of serving it. A wrong result served confidently is
worse than no result. Auto-approve is banned in this codebase."

## 3:00 — Cloudflare + what it powers (terminal)

**Screen:** terminal.

```bash
curl -s "http://localhost:4000/new?hours=720" | head -20
curl -s "http://localhost:4000/export.json?source=11" | head -30
```

**Say:** "These are the hardest pages we've scraped — Cloudflare in front,
client-rendered behind. Bright Data's unlocker went straight through:
HTTP 200 with cf-ray headers on both HackerOne and Bugcrowd. Everything
the dashboard shows is eight public endpoints, CORS-open, serving only
gate-verified rows."

## 3:30 — Close (scroll to foot)

**Screen:** the MYCELIUM foot-mark rising.

**Say:** "One more thing: this entire vertical was swapped in today. The
engine didn't change — not one line of the sentinel, the gates, or the
heal loop. Only the target list. I didn't write a scraper. I wrote the
thing that keeps scrapers honest. github.com/Akash-How/mycelium."

---

## Notes

- The heal loop is already history — the incident timeline **is** the
  footage. Nothing needs to break live on camera.
- If the live page misbehaves, record each section separately and cut.
