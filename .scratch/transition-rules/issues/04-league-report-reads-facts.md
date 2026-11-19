# 04: The league report reads the transition facts

**What to build:** The status part of the session write's league report (entering or leaving ended) comes from the *league tables may change* fact. The leaderboard-changed part, which session-change-cleanup introduces, stays in the session write. Writes that aren't moves have no transition, so the status part is false for them. The session write's doc comment points to the fact. Then run the database-backed mutation run over the module and its readers. No behaviour change.

**Blocked by:** 01, and session-change-cleanup (all tickets), which rewrites the same league report

**Status:** ready-for-agent

- [ ] The league report has no entering-or-leaving-ended check of its own; it reads the fact
- [ ] Existing specs pass without changing their expectations: entering and leaving ended flag league tables; a result-changing write after the end flags them; a write that changes nothing doesn't
- [ ] `pnpm --filter backend mutate:db` for the transition rules module and the move pipeline runs; the table test kills every mutant in the transition rules module; survivors reviewed
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
