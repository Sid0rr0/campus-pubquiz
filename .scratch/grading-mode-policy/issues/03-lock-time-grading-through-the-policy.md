# 03: Lock-time grading and "can be ungraded" through the Grading policy

**What to build:** The closest_guess batch at the lock, kahoot speed scoring when a kahoot question leaves locking, and the "can this question be ungraded" rule all come from the Grading policy, and every one of them behaves exactly as today. After this ticket, neither the answer module nor the block grading module branches on grading mode.

- **Two more policy events, plus the ungraded rule:**
  - _grades at the lock_: whether the question is graded in one batch when its block reaches a graded status. Given its stored rows, it returns the batch writes, or nothing when any row shows the batch already ran. A restart after the lock must never re-run the batch over the quiz master's overrides.
  - _speed score_: question, rows and kahoot timer → rescored writes for auto questions, nothing for the others. It is idempotent: it recomputes from the stored value and response time.
  - _can be ungraded_: false for batch, true otherwise. It replaces the block grading module's exported `canBeUngraded`, which both the Grading refresh and the reveal gate read.
- **The answer module's** `ensureClosestGuessGraded` and `applyKahootSpeedScoring` become _grade at the lock_ and _speed score at the lock_, each driven by the policy. Any private auto-rescore helper left over from ticket 02 goes. The answer module's grading interface is then: submit, hand grade, grade at the lock, speed score at the lock, regrade for a key fix, plus the list and ungraded readers.
- **The block grading module** asks the policy which block questions to batch-grade on entering a graded status, and which questions can be ungraded. Its summary caching, the Grading refresh and the Commit a move steps are unchanged.
- **Docs:**
  - `CODING_STANDARDS.md`: in "Question types are defined once", name the Grading policy as where grading-mode behaviour lives, next to the `scoring.ts` helpers.
  - `docs/architecture.md`: if a diagram shows the block grading module dispatching grading by type to the answer module, redraw it as going through the policy.

Parent spec: `.scratch/grading-mode-policy/spec.md`

**Blocked by:** 02 (Key fixes through the Grading policy). Kahoot speed scoring shares the auto rescore that ticket rewrites.

**Status:** ready-for-agent

- [ ] The Grading policy table spec gains _grades at the lock_ (batch already ran / not yet), _speed score_ (auto with a timer, auto without one, the other modes untouched) and _can be ungraded_ rows, built from registry types so that a new question type needs no new row.
- [ ] The last direct calls to the replaced methods in the answer module's grading specs move to the new calls, keeping every scenario and expected row.
- [ ] Outside the Grading policy, no non-test code in the answer or block grading modules calls `isAutoGradedType`, `isMatchOrHumanType` or `isBatchGradedType`, or reads `gradingMode`.
- [ ] The kahoot scoring, grading-gate, ungraded-restore and `ungraded-agreement` specs pass unchanged.
- [ ] CODING_STANDARDS.md names the Grading policy. `docs/architecture.md` is updated if one of its diagrams showed the old dispatch.
- [ ] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and the backend tests are green.
