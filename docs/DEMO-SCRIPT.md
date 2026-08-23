# Demo video — shot-by-shot script (~4 min)

Record at 1920×1080. Open on the loss, not on the architecture. The
rubric wants problem, workflow, structured output, product — this hits
all four, but it earns attention first.

## Pre-flight (before hitting record)

```bash
npm run api          # dashboard on :4000
npm run orchestrate  # heartbeat, separate terminal
curl http://localhost:4000/reliability
```

Hard-refresh (Ctrl+Shift+R), let the board, fleet and incident rows land.

> Record on **localhost**. It runs the real API and reads LIVE. The Vercel
> build is a static snapshot and honestly says so. Cite the link at the end.

---

## 0:00 — The hook

**Screen:** black. Or the hero, unmoving.

**Say:**

> "I lost five thousand dollars to an hour."
>
> *(beat)*
>
> "Not to a better hacker. To an hour."

**Say:**

> "I found a bug. Behind that one report was a week of research, a proof
> of concept I got working, and nights I didn't sleep. I hit submit and
> waited. The reply came back as one word. **Duplicate.**"
>
> "Someone had filed the same finding hours earlier. Same bug. Same
> severity. Same fix. The program had opened that morning — I found it
> that night. Five thousand dollars to whoever loaded the page first."

## 0:40 — The turn

**Screen:** scroll slowly. EVERY / MINUTE / COUNTS staircases apart.

**Say:**

> "Here's the part that still gets me. The data that would have saved me
> was **public the entire time.** Sitting on a directory page. I had no
> way to watch it — so I refreshed by hand, like everyone does, and lost."
>
> "If I'd known what Bright Data could do, I'd have kept that bounty. So I
> built the thing that would have told me. This is Mycelium."

## 1:10 — The product

**Screen:** the Live board. Tiles, then both columns.

**Say:**

> "380 programs, six platforms, 567 verified rows. Latest from each
> platform on the left, highest rewards on the right. That red dot is a
> program my watcher caught **appearing** — not one I happened to scrape
> today. That dot is the five thousand dollars."

## 1:40 — The workflow

**Screen:** Sources → click **bugcrowd.com** open.

**Say:**

> "Six Scraper Studio collectors. I never wrote a selector. Each one was
> generated from a plain-language contract — the fields it promises,
> described in English. Here's the collector ID, here's its run log, here's
> its latest verified extraction."
>
> "And that English description isn't documentation. It's the ammunition
> for repairs. Watch."

## 2:15 — The star beat

**Screen:** Self-healing → open the **yeswehack** incident, walk three columns.

**Say:**

> "This collector looked healthy. Sixty-three rows. But the sentinel scored
> it against its contract and caught what a row count hides — 36% of titles
> empty, bounty values never populated."
>
> "Column two: the machine compiled that failure into a repair prompt and
> sent it to Bright Data's healing AI. One machine writing a bug report to
> another. Column three: three gates before I believe it. After the heal —
> titles 98%, bounty 95%. I was asleep."

Then open **intigriti**: *"This one was born completely empty. Same loop, no human."*

## 2:55 — The part I'm proudest of

**Screen:** filter to **Quarantined**.

**Say:**

> "These two passed their repair previews and still returned garbage in
> production. So the system benched them instead of serving it."
>
> "A wrong result served confidently is worse than no result. Auto-approve
> is banned in this codebase."

## 3:20 — Cloudflare + the output

**Screen:** terminal.

```bash
curl -s "http://localhost:4000/newest?limit=6&per=3" | head -30
curl -s "http://localhost:4000/export.json" | head -20
```

**Say:**

> "These are the hardest pages I scrape — Cloudflare in front, client-
> rendered behind. Bright Data's unlocker went straight through: HTTP 200
> with cf-ray headers on HackerOne and Bugcrowd. Everything you just saw is
> twelve public endpoints serving only gate-verified rows."

## 3:45 — Close

**Screen:** the MYCELIUM ASCII wordmark. Click once — it burns red.

**Say:**

> "I swapped this entire vertical in on the last day. The engine didn't
> change — not one line of the sentinel, the gates, or the heal loop. Only
> the target list."
>
> "I didn't write a scraper. I wrote the thing that keeps scrapers honest."
>
> "Live at mycelium-lime.vercel.app."

---

## Delivery notes

- **The first ten seconds decide it.** Say the opening line flat and
  unhurried, then stop. Silence sells it. Don't rush to the dashboard.
- **"Duplicate"** is the word the whole video turns on. Land it and pause.
- The heal loop is already history — the incident timeline **is** the
  footage. Nothing needs to break live on camera.
- Mask tokens if a terminal shows them; `bdata` output can carry account
  context.
- Numbers drift as the heartbeat sweeps. Read them off the screen on the
  day rather than trusting the ones written here.
- If the page misbehaves, record each section separately and cut.
