# 03: Grading, answers and bonus awards

Status: done

Blocked by: None

**Type:** task

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `answers-changes.ts` | 1 | 1 |
| `block-grading.service.ts` | 3 | 0 |
| `bonus-awards-changes.ts` | 3 | 0 |

Look like real gaps:

- `block-grading.service.ts:241`: the `regradedQuestionIds.length === 0` early return can be emptied, so no spec shows that a no-op regrade returns the reloaded session with an empty `answeringTeamIds`. `:319-320`: the `hasBatchRun` block and its `summaries` object can be dropped, so no spec asserts the closest-guess summary after a batch run.
- `bonus-awards-changes.ts:98-99`: `BonusAwardNotFoundError` → `BonusAwardNotFoundRefusal` mapping survives being removed or never taken. Add a spec that edits a missing award and expects the refusal.

Look equivalent or low value (assert the message, or disable with a reason):

- `answers-changes.ts:107` (message of "not to a question in the session") survives; `:117` ("Unable to grade answer" fallback for a non-`Error` throw) has no coverage.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Comments

- All three files now show 0 survived and 0 no coverage, with no Stryker disables. Bonus mapping: `bonus-changed.spec.ts` asserts the Refusal types and the pass-through of unrelated errors at the `gameState` seam (the REST layer had been hiding the mapping). `answers-changes.ts`: `grade-and-bonus-write.spec.ts` asserts both messages. `block-grading.service.ts`: the closest_guess regrade spec now checks the recomputed summary on the reveal, and a new DB-free `block-grading.service.spec.ts` (stubbed answer service) covers the no-op regrade, summary merge, question filtering and block-in-play filtering. Two further survivors that the earlier timeouts had masked (`:317`, `:360`) were killed too.
