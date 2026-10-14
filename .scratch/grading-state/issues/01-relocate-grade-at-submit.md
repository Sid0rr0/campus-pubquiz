# 01: Move the submit grade beside the Grading policy

**What to build:** The Grading policy owns "what grade does a submission get the moment it lands". Scoring stops reading the registry's grading mode to decide it and keeps only what a score is (the per-answer score, the batch grader, the key match check). The key-fix rule that asks "would the old key have graded this automatically" calls the relocated function. Nothing a quiz master, team or the big screen sees changes; this is the prefactor that leaves the policy as the single place to read for submit behaviour.

Parent spec: `.scratch/grading-state/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The submit-time grade is decided inside the Grading policy, expressed through its per-mode submit table; Scoring no longer branches on grading mode for it.
- [ ] The submit-time grade cases move from the Scoring tests to the Grading policy spec unchanged (auto, match-or-human match and miss, batch never graded, Number margin cases).
- [ ] Submit, hand grade, lock, kahoot speed scoring and key-fix behaviour are identical: the existing backend answer and grading specs pass untouched.
- [ ] `pnpm typecheck` and the backend and shared-types tests pass.
