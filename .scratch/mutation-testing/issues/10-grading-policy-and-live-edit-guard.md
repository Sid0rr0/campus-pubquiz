# 10: Backend grading policy and live-edit guard

Status: needs-triage

- `answer/grading-policy.ts:187`: `kahootTimerSeconds * 1000` → `/ 1000` survives, and `:193` (the `{ responseMs, timerMs }` timing input) can be forced to `undefined`. No DB-free test checks that kahoot timing reaches the score. This may be covered by a DB-backed spec, so check before adding one.
- `answer/grading-policy.ts:174-176`: the "stored grade equals the new score" check (`gradedAt !== null && verdict === … && pointsAwarded === …`) survives each condition being forced to `true`. This is the rule behind the CLAUDE.md tradeoff "Live answer-key fixes overwrite manual overrides", so it needs a direct test.
- `quiz/live-edit-guard.ts:35`: `roundIndex === roundCount - 1 || round.breakAfter` survives `||` → `&&`, `- 1` → `+ 1` and `false`. Nothing tests the last round as a block end.

Priority: high. Both decide scores or block a live edit.
