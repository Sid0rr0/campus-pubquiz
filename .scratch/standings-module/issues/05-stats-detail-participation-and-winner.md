# 05: Stats detail with the participation rule, departed teams and one winner

**What to build:** The Standings service gains the participation rule. A team took part in a session if it is on the roster *or* has an answer or bonus award there. A team that took part but is no longer on the roster (kicked or left) is **departed**: it's returned with its points but no rank, and it can never be the winner. The service also returns the participant count (ranked plus departed). The live leaderboard still shows roster teams only.

Stats detail reads its standings, winner and team count from the service instead of computing ranks itself:
- tied teams share a rank
- departed teams are listed below every ranked team, marked "left", with no rank
- the single winner's row is marked, even when its rank is shared
- correct-rate and points-percent denominators use the participant count, so no rate exceeds 100%

`SessionDetailStandingRow.rank` becomes nullable and the row gains `hasLeft`. The union query from 872e244 moves into the service. See [spec](../spec.md).

**Blocked by:** 02 (Live leaderboard served by the Standings service)

**Status:** ready-for-agent

- [x] Postgres integration tests on the Standings service seed a kicked team with graded answers, a team that left with only a bonus, and a roster team with nothing. They assert ranked rows, departed rows and the participant count.
- [x] A kicked team with the highest total is departed, unranked, and not the winner. The best roster team wins.
- [x] Stats service tests assert detail's payload: shared ranks for a tie, `rank: null` with `hasLeft: true` for departed teams listed last, the winner marker for a showdown-resolved tie and for an unbroken tie, and participant-based `teamCount`.
- [x] The session-detail calculation no longer sorts or assigns ranks. Its spec asserts that given standings pass through and the denominators use the participant count.
- [x] The stats detail standings table renders "left" for departed teams and highlights the winner. Its frontend test covers both.

## Comments

Implemented in the commit titled `feat(backend,frontend,shared-types): stats detail reads Standings for participation, departed teams and the winner` (hash in git history). `StandingsService` now has `forSessions` (several sessions in a fixed number of queries) and returns `departed` teams, `participantCount` and `winner` per session; the union query from 872e244 moved into it. `computeSessionDetail` takes `standings` instead of `teams` and no longer sorts or ranks. `SessionDetailStandingRow` has nullable `rank`, plus `rankTo`, `hasLeft` and `isWinner` (added beyond the ticket so the table can label shared ranges and mark the winner). The standings table renders "left" and a Winner badge. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
