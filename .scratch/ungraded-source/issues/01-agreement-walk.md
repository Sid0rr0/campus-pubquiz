# 01: Agreement walk pins the admin view's ungraded set against the database

**What to build:** A real-store gateway harness scenario steps one block through every event that changes grading and, after each event, asserts that the admin view's `ungradedQuestionIds` equals the set a fresh database read reports. Events: answer submitted (each human-gradable type), answer revised, answer graded, question locked, break entered, block batch-graded (closest_guess), live answer-key fix, team kicked. closest_guess must never appear in the set. It runs green against today's code and is the safety net for the one-reader change.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] One scenario walks a block through every listed event and asserts view-equals-database after each
- [x] closest_guess never appears in the set at any step; a revised free-text answer puts its question back
- [x] Passes against the current code without production changes
- [x] Reuses the existing harness helpers; no new test seam
- [x] Existing grading specs untouched

## Comments

**Implemented** in `apps/backend/src/game/__tests__/ungraded-agreement.spec.ts` (commit: see git log for "test(backend): pin the admin view's ungraded set against the database"). The walk uses one block of audio, youtube, free_text, multiple_choice and closest_guess. After each step it compares the `ungradedQuestionIds` in the last admin `STATE_UPDATED` with `listUngradedQuestionIds` over the block's questions, leaving out closest_guess.

- **Steps covered:** submitted, revised, graded, locked, break entered, closest_guess batch graded, live key fix (auto, human and closest_guess), team kicked. closest_guess answers are shown to be ungraded in the database before the batch and graded after it, and they never appear in the view.
- **"Revised free-text answer" was read as a human-graded text answer (audio).** Today free_text is auto-graded on every submission, so a revised free_text answer never comes back as ungraded. The walk also revises a free_text answer and checks that it stays off the list. An audio answer that was graded and then revised to a different value does come back.
- **The walk is not a no-op.** Making the per-answer patch never mark a question ungraded fails it at the first step.
- **No production code changed.** It only uses the existing harness helpers.
