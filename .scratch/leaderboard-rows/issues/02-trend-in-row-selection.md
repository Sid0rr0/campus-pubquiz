# 02: Trend moves into row selection

**What to build:** Each row from row selection also carries its trend (`up`, `down`, `same`, or none). Row selection takes the trend baseline and the current round index as extra inputs. The leaderboard view stops working out trend and just draws the icon for the trend each row carries. The arrows on the big screen are exactly as before.

Rules, each unchanged from today:

- The trend basis is the previous entries, else the trend baseline, else the current round's points backed out. There is no trend when none of these is given.
- Ranks on the basis come from the shared ranking rule.
- "Up" is forced for every team when the basis has more than one team and no two different totals.
- Trend is reported only in the `settled` phase.

**Blocked by:** 01 (Row selection: cap, reveal walk and old-board pool)

**Status:** ready-for-agent

- [ ] Rows carry a trend. The view's trend helpers (rank by score, round backed out, established order, rank-trend comparison) are gone from the view.
- [ ] Table-driven tests cover:
  - no trend without a basis
  - up, down and same over a round
  - a team with no recorded points for the round counting as 0
  - held, pulled-level and split ties against the trend baseline
  - the trend baseline winning over the round approximation, and the previous entries winning over both
  - forced "up" on an all-tied old board, including the first-ever Kahoot board
  - no trend in `old` or `counting`
- [ ] The leaderboard DOM tests are cut down to:
  - the bonus-star cases
  - the three-beat phase sequence with fake timers
  - one smoke test that a revealed row renders its label, name, total and trend icon
  - the plain preview rendering with no animation
- [ ] The display page's leaderboard tests pass unchanged. `pnpm --filter frontend test` and `pnpm typecheck` pass.
