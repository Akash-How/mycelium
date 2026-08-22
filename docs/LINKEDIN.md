# LinkedIn post draft (Daily Bugle track)

Post from your account, tag @WeMakeDevs, attach: hero screenshot +
incident-timeline screenshot. LinkedIn only (per the track rules).

---

In bug bounty, the first submission wins. So I spent Into the Scrape-Verse
building something that watches every platform for me.

Mycelium tracks 266 programs across Bugcrowd, YesWeHack and Intigriti —
and tells me the moment a new one appears.

The hard part wasn't scraping. It was staying correct.

5 of my collectors were born broken. One returned 63 rows that looked
fine — until the sentinel scored them against their contract and found
36% of program titles empty and bounty values never populated. No human
noticed that. The system did:

→ sentinel scores every run against a machine-readable contract
→ a diagnostician compiles the failure into a repair prompt
→ Bright Data's healing AI rewrites the scraper
→ three gates decide whether to believe it

After the heal: titles 98%, bounty values 95%.

Two collectors never earned that trust — they passed their repair
previews and still returned empty fields in production. The system
benched them rather than serve it. A wrong result served confidently is
worse than no result.

Two things I learned the hard way:
• `scraper approve` without `--auto-save` reports success while silently
  discarding the healed template. Only caught it because verification
  runs against production, not previews.
• A collector was emitting every program 8 times from duplicate DOM
  matches — 192 rows, 24 programs. Row counts lie.

Bonus: I pivoted the whole vertical on the last day, from AI pricing to
bug bounty. The engine didn't change — not one line of the sentinel, the
gates or the heal loop. Only the target list.

Repo: github.com/Akash-How/mycelium
Built on Bright Data Scraper Studio for @WeMakeDevs' hackathon.

#IntoTheScrapeVerse #BugBounty #WebScraping #BrightData
