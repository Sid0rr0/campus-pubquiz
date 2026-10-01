# 01: Agreement walk pins the admin view's ungraded set against the database

**What to build:** A real-store gateway harness scenario steps one block through every event that changes grading and, after each event, asserts that the admin view's `ungradedQuestionIds` equals the set a fresh database read reports. Events: answer submitted (each human-gradable type), answer revised, answer graded, question locked, break entered, block batch-graded (closest_guess), live answer-key fix, team kicked. closest_guess must never appear in the set. It runs green against today's code and is the safety net for the one-reader change.

Parent spec: `.scratch/ungraded-source/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One scenario walks a block through every listed event and asserts view-equals-database after each
- [ ] closest_guess never appears in the set at any step; a revised free-text answer puts its question back
- [ ] Passes against the current code without production changes
- [ ] Reuses the existing harness helpers; no new test seam
- [ ] Existing grading specs untouched
