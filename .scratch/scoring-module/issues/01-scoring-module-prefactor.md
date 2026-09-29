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

**Status:** ready-for-agent

- [ ] Table-driven tests on the Scoring interface cover:
  - every type
  - match in both modes with 0, 1 and n wrong pairs
  - free_text normalisation
  - kahoot speed at 0, mid, at and past the timer, with no timer, and with no response time
  - wrong kahoot answers
  - closest_guess batches with ties, non-numeric guesses and no submissions
  - manual-grade verdicts
  - the category lists, including that free_text is auto-graded but not kahoot-allowed
- [ ] The answer module and block grading call Scoring with a question value. No grading operation takes separate type/answer/points/mode arguments.
- [ ] Import and the quiz draft schema reject non-kahoot-allowed types using Scoring's list. The old duplicated type lists are gone.
- [ ] The socket contract comments that call free_text admin-graded are corrected.
- [ ] All existing backend, shared-types and frontend tests pass unchanged, apart from specs that asserted the old positional arguments, which are rewritten to assert stored results.
