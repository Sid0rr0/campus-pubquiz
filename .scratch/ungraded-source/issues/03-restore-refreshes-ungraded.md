# 03: A restored session knows its ungraded questions straight away

**What to build:** When sessions are restored after a restart, the one reader fills `ungradedQuestionIds` for the restored progress whenever the restored status is one where the cache is trusted (the grading statuses). A backend that restarts mid-break therefore shows the right ungraded markers on `/control` immediately, and showdown eligibility on the last block is false while anything is ungraded. Outside the grading statuses the cache keeps its current meaning.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** 02, session-settle 03 (restore is rewritten to go through the settle step there; this ticket plugs into that restore path rather than racing it)

**Status:** done

- [x] New harness case: restart mid-break with an ungraded human-gradable answer; right after restore the admin view lists that question as ungraded
- [x] New harness case: restart mid-break on the last block with something ungraded; showdown eligibility is false until it is graded
- [x] A restart outside the grading statuses behaves as today (empty cache, no extra query required)
- [x] The hand-written restore path gains no new bespoke recompute beyond calling the reader
- [x] Existing restart and persistence specs pass unchanged

## Comments

**Implemented** (commit: see git log for "feat(backend): a restored session rebuilds its ungraded questions").

- `GameStateService.onModuleInit` passes the fresh session and the saved progress through `BlockGradingService.refreshUngradedQuestionIds` before `settleSession`; no recompute of its own. That method is already a no-op outside the grading statuses, so those restarts stay empty and run no extra query.
- New `ungraded-restore.spec.ts` restarts mid-break on the final block: the ungraded question is listed and showdown eligibility is false; with nothing ungraded the showdown is offered; a restart in `question_open` keeps the cache empty.
- Backend typecheck, lint and the full Jest suite pass.
