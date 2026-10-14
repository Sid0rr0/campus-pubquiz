# 01: The played-sessions list sorts by the Standings module's totals

Status: done

Spec: [Stats take totals from the Standings module and credit answers by verdict](../spec.md)

**What to build:** The Standings module provides each session's participant count and winner's total as a query the stats module can join and order by. The played-sessions list sorts by teams and by winner using that query, not its own copy of the participation and total rules. Sorting, paging and the total count behave exactly as today.

- Write the agreement test first, in the stats module's Postgres spec. Seed ended sessions with:
  - a departed team holding the highest total;
  - a negative bonus award that changes the winner;
  - an empty roster;
  - a team that only got a bonus award.

  Assert that sorting by winner (both directions) orders rows by the winning points they show, with the empty roster below every winner (first ascending, last descending), and that sorting by teams orders rows by the team count they show. It may already pass; it guards against drift.

- In the Standings module, build the totals query from the same participant and per-team total subqueries its standings use. Each subquery is defined once, so the standings and the totals query can't differ. The totals query gives per session:
  - the participant count;
  - the highest roster team total, or none for an empty roster.
- In the stats module, drop its own participant, answer-total, bonus-total and winner-total subqueries, and join the Standings module's totals query for the teams and winner sort columns. Keep max points, title, played-at, the session-id tiebreak and the page count.

## Acceptance criteria

- [ ] The agreement test passes
- [ ] The stats module holds no participant or team-total SQL of its own
- [ ] The Standings module's standings and the totals query share one definition of taking part and of a team's total
- [ ] The existing stats module and Standings module specs pass
- [ ] `pnpm typecheck` and `pnpm test` pass
