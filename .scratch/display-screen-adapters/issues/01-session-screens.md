# 01: Session screens draw their Display screen directly: lobby, join overlay, round overview, ended

**What to build:** The lobby, join overlay, round overview and ended screens take the props the Display screen view already hands every screen (the typed screen of their kind, the quiz preview context with its settings and quiz structure, the live context, the live media flags and the connected flag), and read what they need. Their pass-through adapters in the Display screen view and their own duplicate props interfaces are deleted, and the screen-kind table points at them directly. The big screen and the quiz preview look and behave exactly as before.

- The shared screen-view props type is exported from the Display screen view, unchanged in shape. Screens import it as a type-only import, so there is no runtime cycle.
- Behaviour the adapters carried moves into the screens unchanged: lobby and join overlay draw nothing without a live context; ended falls back to an empty leaderboard.
- The screen-kind table keeps its mapped type over every Display screen kind, so a missing kind still fails typecheck.
- Shared components and the adapters that do real work (leaderboard, rules, showdown, locking, the round-title-card views, joker pick, reveal) are untouched.

Ticket 02 collapses the open question, break intro and break review. No `/guide` or docs text.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The four screens take the shared screen-view props; their adapters and props interfaces no longer exist
- [ ] Display screen view tests, rendered from a Display screen fixture (reuse the suite's builders): a live-context case for each of lobby, join overlay, round overview and ended, and a no-live case showing lobby and join overlay draw nothing and ended draws an empty leaderboard
- [ ] The existing Display screen view suite passes unchanged
- [ ] `pnpm typecheck`, the frontend tests and `pnpm crap:changed` pass (if a screen goes over 10, extract a sub-component with plain props inside its file rather than restoring an adapter)
