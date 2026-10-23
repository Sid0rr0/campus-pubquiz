# 08: Scoring, margin, ranking and joker: the last few survivors

Status: needs-triage

These files score 92–98%. Triage the few survivors one by one:

- `margin.ts:44-46`: the rounding tolerance `Number.EPSILON * ROUNDING_ERROR_ULPS / Math.max(|key|, |answer|, 1)` survives `*` → `/` and `max` → `min`. No test sits right on the margin edge with large or fractional numbers.
- `ranking-rule.ts:22`: `a < b ? -1 : 1` → `a <= b` is probably equivalent (equal values are handled before this line). Check, then disable with a reason. `:38`: the `teamId` tiebreak isn't covered by any test.
- `scoring.ts:57`: `names.length <= 1` (joining tied names) survives `<`, so a single-name tie isn't asserted.
- `joker.ts:107`: `pickableRoundIds.length - 1` → `+ 1` survives.
- `question-correct-rate.ts:15`: the `verdict !== 'partial' || questionPoints <= 0` guard can be forced to `false`.
- `answer-kind.ts:59`: `toLowerCase()` → `toUpperCase()` is equivalent for a case-insensitive comparison. Disable it with a reason.
