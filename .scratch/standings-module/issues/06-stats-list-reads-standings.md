# 06: Stats list reads Standings

**What to build:** The played-sessions list gets its team count and winner from the Standings service, so it always agrees with stats detail:
- `teamCount` is the participant count, including departed teams
- `winnerTeamName` is the Standings winner: never a departed team, the showdown winner when a showdown broke a tie, and the same name-order fallback as detail when a tie was never broken
- `winnerAnswerPoints` becomes `winnerPoints`, the winning total including bonus (and any showdown bonus)

Sorting by winner points still works with server-side pagination. It sorts on the session's highest roster-team total, which doesn't depend on tie order, so no tie rule is needed in SQL. The Standings service then loads the returned page's sessions in a fixed number of queries, never one per session. The list's old roster-only team-count and winner subqueries are deleted. The frontend list's "Winner points" column reads the new field. See [spec](../spec.md).

**Blocked by:** 05 (Stats detail with the participation rule, departed teams and one winner)

**Status:** ready-for-agent

- [x] Stats service tests assert that for the same session, list and detail agree on team count and winner. Cases: a kicked team (counted, never winner), a showdown-resolved tie, and an unbroken tie for first.
- [x] Sorting by winner points in both directions across more than one page returns sessions in the right order, with sessions that have no teams last.
- [x] A multi-session Standings call returns each session's own standings without mixing teams across sessions.
- [x] The shared stats payload type and the list's frontend column and tests use `winnerPoints`. `winnerAnswerPoints` is gone.

## Comments

Implemented in the commit titled `feat(backend,frontend,shared-types): stats list reads Standings` (hash in git history). `listPlayedSessions` takes `teamCount`, `winnerTeamName` and `winnerPoints` from `StandingsService.forSessions` for the returned page only (one call, fixed queries). SQL keeps only what sorting and paging need: a participant count (roster, answers or bonuses) and the highest roster-team total. `winnerAnswerPoints` was renamed `winnerPoints` in the shared type, panel and tests. `Status:` left as `ready-for-agent` — the triage vocabulary has no done state.
