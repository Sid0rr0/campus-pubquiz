# 04: Display and phone overlay render server ranks

**What to build:** `/display`'s leaderboard, the team phones' leaderboard overlay and `/remote` render rank labels ("1.", "2.–4.") straight from each entry's `rank`/`rankTo`, in the order received. They no longer group ties themselves. The display's rank-trend arrows and bottom-up reveal animation still compare against a previous board. They rank that board with the shared ranking rule, so a team that stayed tied never shows as having dropped. Kahoot top-5 and reveal steps keep their current behaviour. See [spec](../spec.md).

**Blocked by:** 02 (Live leaderboard served by the Standings service)

**Status:** ready-for-agent

- [ ] The display leaderboard's own tie-grouping and rank-label code is gone. Labels come from `rank`/`rankTo`.
- [ ] Trend and reveal code ranks previous boards with the shared ranking rule, not a local re-implementation.
- [ ] Display, leaderboard-overlay and remote tests feed pre-ranked entries and assert:
  - labels for a clear order and for a tie in the middle
  - trend arrows when a tie holds, forms and splits
  - one reveal step per tie group, including a kahoot round capped at top 5
