# 03: A restored session knows its ungraded questions straight away

**What to build:** When sessions are restored after a restart, the one reader fills `ungradedQuestionIds` for the restored progress whenever the restored status is one where the cache is trusted (the grading statuses). A backend that restarts mid-break therefore shows the right ungraded markers on `/control` immediately, and showdown eligibility on the last block is false while anything is ungraded. Outside the grading statuses the cache keeps its current meaning.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** 02, session-settle 03 (restore is rewritten to go through the settle step there; this ticket plugs into that restore path rather than racing it)

**Status:** ready-for-agent

- [ ] New harness case: restart mid-break with an ungraded human-gradable answer; right after restore the admin view lists that question as ungraded
- [ ] New harness case: restart mid-break on the last block with something ungraded; showdown eligibility is false until it is graded
- [ ] A restart outside the grading statuses behaves as today (empty cache, no extra query required)
- [ ] The hand-written restore path gains no new bespoke recompute beyond calling the reader
- [ ] Existing restart and persistence specs pass unchanged
