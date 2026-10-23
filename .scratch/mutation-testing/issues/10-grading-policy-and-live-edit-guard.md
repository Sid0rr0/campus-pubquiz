# 10: Backend grading policy and live-edit guard

Status: done

Blocked by: None

- `answer/grading-policy.ts:187`: `kahootTimerSeconds * 1000` → `/ 1000` survives, and `:193` (the `{ responseMs, timerMs }` timing input) can be forced to `undefined`. No DB-free test checks that kahoot timing reaches the score. This may be covered by a DB-backed spec, so check before adding one.
- `answer/grading-policy.ts:174-176`: the "stored grade equals the new score" check (`gradedAt !== null && verdict === … && pointsAwarded === …`) survives each condition being forced to `true`. This is the rule behind the CLAUDE.md tradeoff "Live answer-key fixes overwrite manual overrides", so it needs a direct test.
- `quiz/live-edit-guard.ts:35`: `roundIndex === roundCount - 1 || round.breakAfter` survives `||` → `&&`, `- 1` → `+ 1` and `false`. Nothing tests the last round as a block end.

Priority: high. Both decide scores or block a live edit.

## Decisions (2026-10-23)

- Priority: high.
- Don't check the DB-backed specs: add the cases straight to the DB-free `answer/__tests__/grading-policy.spec.ts`, so the policy's own spec pins its own rules. Cover the kahoot timer conversion (`* 1000`) and timing input (`:187-193`), and each condition of `isGradedAutomatically` (`:174-176`).
- `quiz/live-edit-guard.ts:35` (last round counts as a block end) gets a test.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
