# Demo video — 2:50

Record at 1920×1080. Say it once, move on. No intro, no sign-off.

```bash
npm run api          # dashboard on :4000
npm run orchestrate  # heartbeat, separate terminal
```

Hard-refresh, let the rows land. Record on **localhost** — it runs the
real API and reads LIVE; the Vercel build is a snapshot and says so.

---

**0:00 — Hero**

> I lost a five thousand dollar bounty because I found the program eight
> hours late. Same bug, same severity, filed second. Duplicate.
>
> The listing was public the whole time. I just had no way to watch it.
> So I built this.

**0:20 — Live board**

> Mycelium tracks 380 bug bounty programs across six platforms. 567
> verified rows. Newest per platform on the left, biggest rewards on the
> right. The red dot means the watcher saw that program appear — that's
> the alert I needed.

**0:45 — Sources, open bugcrowd.com**

> Six Scraper Studio collectors. I never wrote a selector. Each one is
> generated from a plain-language contract — the fields it promises,
> in English. Collector ID, run log, latest extraction.
>
> That English description isn't documentation. It's what repairs the
> scraper when the site changes.

**1:15 — Self-healing, open the yeswehack incident**

> This collector returned 63 rows and looked fine. The sentinel scored it
> against its contract and found 36% of titles empty and bounty values
> never populated.
>
> Column two: that failure gets compiled into a repair prompt and sent to
> Bright Data's healing AI. Column three: three gates decide whether to
> trust the result. Titles went to 98%, bounty to 95%. No human involved.

Open **intigriti**: *"Born completely empty. Same loop."*

**1:55 — Quarantined filter**

> These two passed their repair previews and still returned garbage in
> production, so the system benched them instead of serving it. A wrong
> answer served confidently is worse than no answer.

**2:15 — Terminal**

```bash
curl -s "http://localhost:4000/newest?limit=6&per=3" | head -20
```

> HackerOne and Bugcrowd are Cloudflare-protected and client-rendered.
> Bright Data's unlocker went through both — HTTP 200 with cf-ray headers.
> Twelve public endpoints, only gate-verified rows.

**2:40 — Finale**

> I swapped the entire vertical on the last day. The engine didn't change,
> only the target list.
>
> I didn't write a scraper. I wrote the thing that keeps scrapers honest.
> mycelium-lime.vercel.app.

---

**Notes**

- Don't pause for effect. Say the first two lines at normal pace and keep
  moving — the facts carry it.
- The heal already happened; the incident timeline is the footage. Nothing
  breaks live on camera.
- Mask tokens if a terminal shows them.
- Numbers drift with each sweep — read them off the screen on the day.
