# 02: Key fixes through the Grading policy

**What to build:** A live answer-key fix rescores answers exactly as it does today, but the Grading policy decides it. The answer module's three per-mode regrade paths become one call, and the block grading module stops dispatching by grading mode.

- **The policy's _key fix_ event.** Inputs: the corrected question, the question as it was before the fix, its stored answer rows, the kahoot timer (or none), and whether the batch has already run. Output: a write per row (set, clear, keep), plus whether the question was rescored at all. Per grading mode:
  - _auto_ rescores every row, speed-scaled from the stored response time when a timer is given.
  - _match-or-human_ sets a newly matching row correct, clears a row that was graded automatically under the old key (using ticket 01's rule) and no longer matches, and keeps every other row.
  - _batch_ re-runs the batch only when it has already run. Otherwise it reports "not rescored".
- **The answer module** replaces `regradeAutoGraded`, `regradeMatchOrHuman` and the key-fix use of `gradeClosestGuess` with one _regrade for a key fix_ call. It reads the rows, asks the policy, writes the result with one grading time per flush, and returns whether the question was rescored and its answers. Kahoot speed scoring still needs the auto rescore until ticket 03, so keep it reachable as a private helper or route it through the policy's auto entry. Don't leave a second public regrade method.
- **The block grading module's key-fix regrade** becomes one call per corrected question, with no grading-mode branches. It passes "has the batch run" from whether the session holds that question's closest_guess summary, as today. When a summary is held, it recomputes it from the returned answers, so a fix with zero answers still updates the summary's target. `regradeForKeyFix`'s return shape and the Grading refresh are unchanged.

Parent spec: `.scratch/grading-mode-policy/spec.md`

**Blocked by:** 01 (Grading policy for submit and hand grading). That ticket adds the module and the "graded automatically" rule this one reuses.

**Status:** ready-for-agent

- [ ] The Grading policy table spec gains _key fix_ rows: matching now; graded automatically under the old key; moderator grade; moderator grade identical to the automatic one (cleared, per the accepted tradeoff); auto with and without a kahoot timer; batch run and not run.
- [ ] Every direct call to the replaced regrade methods in the answer module's grading specs moves to _regrade for a key fix_, keeping every scenario and expected row.
- [ ] The block grading module's key-fix regrade has no `isAutoGradedType`, `isMatchOrHumanType` or `isBatchGradedType` checks.
- [ ] `live-edit-regrade.spec.ts`, `quiz-edited.spec.ts` and `ungraded-agreement.spec.ts` pass unchanged.
- [ ] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and the backend tests are green.
