# 01: Scoring module prefactor

**What to build:** A pure Scoring module in shared types that owns:
- every question type's auto-grade rule
- the half-points rule
- the closest_guess batch rule
- the manual-grade verdict rule
- the category lists: graded at submit, batch-graded, human-graded, kahoot-allowed and overridable

The kahoot-allowed list is explicit (multiple_choice, sort, match), per ADR 0001. The answer module's grading operations (submit, regrade after a live edit, kahoot speed scoring, closest_guess batch) take a question value instead of separate type/answer/points/mode arguments and delegate to Scoring. Quiz import and the editor draft schema read the kahoot-allowed list from Scoring.

This is behaviour-preserving: every score is identical to today. Verdicts are computed but not yet stored or sent. See [spec](../spec.md).

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Table-driven tests on the Scoring interface cover:
  - every type
  - match in both modes with 0, 1 and n wrong pairs
  - free_text normalisation
  - kahoot speed at 0, mid, at and past the timer, with no timer, and with no response time
  - wrong kahoot answers
  - closest_guess batches with ties, non-numeric guesses and no submissions
  - manual-grade verdicts
  - the category lists, including that free_text is auto-graded but not kahoot-allowed
- [x] The answer module and block grading call Scoring with a question value. No grading operation takes separate type/answer/points/mode arguments.
- [x] Import and the quiz draft schema reject non-kahoot-allowed types using Scoring's list. The old duplicated type lists are gone.
- [x] The socket contract comments that call free_text admin-graded are corrected.
- [x] All existing backend, shared-types and frontend tests pass unchanged, apart from specs that asserted the old positional arguments, which are rewritten to assert stored results.

## Comments

Implemented in the commit that adds `shared/types/src/scoring.ts` (find it in git history: `feat(shared-types): add pure Scoring module`). Status set to `done`.

- Import (`question-row.schema.ts`) never carries `kahootMode`, so it had no kahoot type list to replace; only the draft schema's duplicate list existed and now reads Scoring's.
- Verdicts are computed by Scoring but not stored or sent, as scoped. Kahoot speed still uses `updatedAt` and the in-memory multipliers (ticket 02 removes them); the multiplier formula now lives in Scoring's `speedMultiplier`.
- Preserved quirk: a blank closest_guess guess counts as `0` (`Number('')`).
