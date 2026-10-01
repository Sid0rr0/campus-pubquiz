# 03: The grading stages, break entry and restore end through the grading refresh

**What to build:** These paths now go through the grading refresh from ticket 01:

- the closest_guess batch at the lock
- kahoot speed scoring when a kahoot question leaves locking
- the bulk refresh of the block's ungraded set when the break starts
- restoring a session after a restart

The two grading stages pass the questions they scored. Those can never be ungraded, so only the standings move. Break entry and restore pass the whole block and keep today's gating on the break statuses. Grading's own internal "fetch standings, put them on the session" step is deleted. Nothing changes on stage. The leave-break gate keeps reading the database directly through the ungraded reader.

Parent spec: `.scratch/grading-refresh/spec.md`

**Blocked by:** 01 (A live answer-key fix refreshes /control's ungraded markers).

**Status:** done

- [x] The closest_guess batch and kahoot speed scoring end through the grading refresh, and the internal standings step is deleted.
- [x] Break entry and restore fill the ungraded set through the grading refresh, only in the break statuses, as today.
- [x] Advance out of the break is still refused with the list of ungraded questions, read from the database rather than the cached set.
- [x] Pass unchanged: the ungraded agreement walk, ungraded restore, the grading gate, leaderboard, kahoot scoring, and the closest_guess reveal specs.

## Comments

Implemented in the commit titled `feat(backend): the grading stages, break entry and restore end through the grading refresh` (see git history for the hash).

- `ensureBlockGraded` and `ensureKahootSpeedScored` pass the questions they scored to `gradingRefresh` and apply it with `withGradingRefresh`; the private `withFreshLeaderboard` standings step is deleted.
- `refreshUngradedQuestionIds` (break entry and restore) refreshes the whole block through `gradingRefresh`, still gated on the break statuses, and replaces the cached set outright so nothing from an earlier block survives.
- The leave-break gate still reads `getUngradedBlockQuestionIds` straight from the database.
- The backend suite passes apart from `presenter-context.spec.ts`, which has someone else's uncommitted work in progress; it fails identically with and without this change.
