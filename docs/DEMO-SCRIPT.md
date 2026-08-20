# Demo video — shot-by-shot script (~4 min)

Record at 1920×1080, dashboard at http://localhost:4000, terminal ready.
Before recording: hard-refresh the page once, run the dry-run below.

## Dry run (do this before hitting record)

```bash
npm run api          # dashboard on :4000
npm run orchestrate  # heartbeat (separate terminal)
curl http://localhost:4000/reliability
```

All green? Record.

---

## 0:00 — The hook (hero)

**Screen:** the dashboard hero. Scroll slowly so PAGES / INTO / PROOF
staircases out over the network.

**Say:** "Every scraper ever written has the same fate: it works in the
demo, then the site changes and it breaks — quietly. This is Mycelium.
A web data network that watches its own output, writes its own repair
orders, and refuses to serve data it can't verify."

## 0:35 — The fleet (scroll to Network)

**Screen:** fleet rows. Click **deepinfra** open — the contract column,
run log, latest extraction.

**Say:** "Six sources, AI infrastructure pricing. Every scraper here is
a Bright Data Scraper Studio collector — and every one carries a
contract: the fields it promises, in plain language. That description
isn't documentation. It's ammunition. You'll see why."

## 1:10 — The star beat (scroll to The Loop)

**Screen:** incident timeline. Open the **together.ai** incident.
Point at the three columns in order.

**Say:** "This collector was born broken — zero rows. Column one: our
sentinel detected it, no human. Column two: the diagnostician compiled
the contract into this repair prompt and sent it to Bright Data's
healing AI — one machine writing a bug report to another. Column
three: the repaired scraper had to pass three gates before we believed
it. Here's the part that matters —" *(open modal's incident)* "— this
one passed preview twice and still returned garbage in production. So
the system benched it. A wrong price served confidently is worse than
no price. Auto-approve is banned in this codebase."

## 2:20 — The receipts (stats)

**Screen:** scroll up to the giant stats; hover to reveal annotations.

**Say:** "This isn't one staged demo break. Five real incidents today,
four healed unattended, mean recovery 27 minutes, two collectors
benched on evidence. The reliability numbers are the product."

## 2:45 — Markets + the finding

**Screen:** divergence matrix, hover a few cells.

**Say:** "We probed every source from eight countries through Bright
Data's unlocker. The finding: AI compute speaks one currency to the
whole world. A uniform row is a finding too."

## 3:05 — What it powers (terminal)

**Screen:** terminal.

```bash
curl -s http://localhost:4000/export.json?source=1 | head -40
```

**Say:** "356 verified rows, live, self-maintaining. Every collector
doubles as a Bright Data API endpoint — and this export only serves
runs that passed verification. Data you can build on."

## 3:30 — Close (scroll to foot)

**Screen:** the MYCELIUM foot-mark rising.

**Say:** "We didn't write a scraper. We wrote the thing that keeps
scrapers honest — and it doesn't stop when the hackathon does.
github.com/Akash-How/mycelium."

---

## Fallback footage

If the live page misbehaves on record day, screen-record each section
separately and cut. The heal loop is already history — the incident
timeline IS the footage; nothing needs to break live.
