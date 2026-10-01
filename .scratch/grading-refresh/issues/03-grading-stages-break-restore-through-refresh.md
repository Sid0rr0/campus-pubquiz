# 03: The grading stages, break entry and restore end through the grading refresh

**What to build:** These paths now go through the grading refresh from ticket 01:

- the closest_guess batch at the lock
- kahoot speed scoring when a kahoot question leaves locking
- the bulk refresh of the block's ungraded set when the break starts
- restoring a session after a restart

The two grading stages pass the questions they scored. Those can never be ungraded, so only the standings move. Break entry and restore pass the whole block and keep today's gating on the break statuses. Grading's own internal "fetch standings, put them on the session" step is deleted. Nothing changes on stage. The leave-break gate keeps reading the database directly through the ungraded reader.

Parent spec: `.scratch/grading-refresh/spec.md`

**Blocked by:** 01 (A live answer-key fix refreshes /control's ungraded markers).

**Status:** ready-for-agent

- [ ] The closest_guess batch and kahoot speed scoring end through the grading refresh, and the internal standings step is deleted.
- [ ] Break entry and restore fill the ungraded set through the grading refresh, only in the break statuses, as today.
- [ ] Advance out of the break is still refused with the list of ungraded questions, read from the database rather than the cached set.
- [ ] Pass unchanged: the ungraded agreement walk, ungraded restore, the grading gate, leaderboard, kahoot scoring, and the closest_guess reveal specs.
