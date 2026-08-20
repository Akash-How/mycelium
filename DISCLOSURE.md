# AI-use disclosure

Per the Into the Scrape-Verse rules, AI coding assistants must be disclosed.

This project was built with **Claude Code** (Claude Fable 5) working as a
pair-programmer driven by the participant, during the hackathon window.
The participant directed the architecture, made all product decisions
(vertical, fleet targets, verification policy), performed the birth
certificates (human review of every collector's first output), and reviews
all code.

Bright Data's **Scraper Studio AI** generated the scraper extraction code
behind every `c_*` collector, and rewrote it during heals — that is the
platform being showcased.

The design decisions we consider ours: the sentinel's scoring rules, the
three verification gates (contract / golden / continuity), the ban on
`--auto-approve`, the quarantine circuit-breaker, the candidate proving
funnel, and the geo divergence discriminator.

The dashboard's visual design system (typography scale, preloader,
section rail, stat grid patterns) is adapted from the participant's own
prior project (GLASSBOX cockpit, github.com/arjunarav/signoz-sre-sidekick),
reimplemented for Mycelium's content and live data.
