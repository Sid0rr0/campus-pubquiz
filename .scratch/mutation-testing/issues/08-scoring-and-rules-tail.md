# 08: Scoring, margin, ranking and joker: the last few survivors

Status: done

Blocked by: None

These files score 92–98%. Triage the few survivors one by one:

- `margin.ts:44-46`: the rounding tolerance `Number.EPSILON * ROUNDING_ERROR_ULPS / Math.max(|key|, |answer|, 1)` survives `*` → `/` and `max` → `min`. No test sits right on the margin edge with large or fractional numbers.
- `ranking-rule.ts:22`: `a < b ? -1 : 1` → `a <= b` is probably equivalent (equal values are handled before this line). Check, then disable with a reason. `:38`: the `teamId` tiebreak isn't covered by any test.
- `scoring.ts:57`: `names.length <= 1` (joining tied names) survives `<`, so a single-name tie isn't asserted.
- `joker.ts:107`: `pickableRoundIds.length - 1` → `+ 1` survives.
- `question-correct-rate.ts:15`: the `verdict !== 'partial' || questionPoints <= 0` guard can be forced to `false`.
- `answer-kind.ts:59`: `toLowerCase()` → `toUpperCase()` is equivalent for a case-insensitive comparison. Disable it with a reason.

## Decisions (2026-10-23)

- Disable `ranking-rule.ts:22` (`<` → `<=`) as equivalent: the line above already returns 0 when `a === b`.
- Disable `answer-kind.ts:59` (`toLowerCase` → `toUpperCase`) as equivalent for a case-insensitive compare.
- The other survivors listed above get tests.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
