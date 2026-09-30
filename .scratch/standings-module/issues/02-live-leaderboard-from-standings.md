# 02: Live leaderboard served by the Standings service

**What to build:** A backend Standings service that loads one session's standings: every roster team with quiz points, bonus points (net, positive, negative), per-round points, `rank`/`rankTo` and the single winner, all from the ranking rule. The live leaderboard comes from this service instead of the answer service's own query. Every existing caller that refreshes the leaderboard (grading, bonus awards, admin actions, block grading, game state) gets the same data from the new source.

`LeaderboardEntry` gains `rank` and `rankTo`, and the snapshot's leaderboard arrives already in final order, including after a reconnect. A tie for first broken by a showdown needs no special handling: the showdown's bonus puts its winner strictly first.

Clients are not changed in this ticket and keep working with the extra fields. See [spec](../spec.md).

**Blocked by:** 01 (Ranking rule prefactor)

**Status:** ready-for-agent

- [x] Postgres integration tests (testcontainers) on the Standings service cover:
  - a roster team with no answers, at zero
  - a team with answers only, and a team with a bonus only
  - two teams tied on total, sharing a rank
  - a showdown won by one of two tied teams, which comes out as the single winner and only rank-1 team
  - per-round points for the session's current quiz
  - no fan-out when a team has several answers and several bonus awards
- [x] The answer service no longer has its own leaderboard query. Callers read standings from the Standings service.
- [x] State snapshots carry leaderboard entries with `rank`/`rankTo`, in final order.
- [x] Existing leaderboard, showdown, reveal and snapshot specs pass, updated only where they assert the new rank fields.

## Comments

Implemented in the commit titled `feat(backend,shared-types): serve the live leaderboard from a Standings service` (hash in git history). New `apps/backend/src/standings/standings.service.ts` (`forSession` returns the ranked roster and the single winner; `leaderboard` is the roster alone) loads totals in SQL and orders/ranks through `rankTeams`. `AnswerService.computeLeaderboard` and its `GameSessionTeam` dependency are gone; `GameStateService` and `BlockGradingService` read `StandingsService`. `LeaderboardEntry` gained required `rank`/`rankTo`; frontend fixtures and the teams table's zero-fill entry got placeholder ranks (clients still order and rank on their own until tickets 03-04). The old answer-service leaderboard spec moved to `standings/__tests__/standings.service.spec.ts`. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
