# 04: Showdown and bonus awards

Status: ready-for-agent

Blocked by: None

**Type:** task

Parent spec: `.scratch/mutation-testing-services/spec.md`

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `showdown.service.ts` | 15 | 6 |
| `bonus.service.ts` | 5 | 0 |

Look like real gaps:

- `showdown.service.ts:52-65`: input validation. `trimmedQuestion` is never tested empty or padded (`:55-57`, the empty-question block has no coverage), the answer check `trimmedAnswer === ''` (`:60`) can be dropped, and the points check (`:63`) survives `false`, `&&`, `< 0` and `|| false` (`:65` message is uncovered). Add specs for an empty question, an empty or non-numeric answer, and zero, negative and `NaN` points.
- `showdown.service.ts:79`: `orderIndex` counts `showdownRounds` without the session filter, so a second session's rounds would shift it. `:105`: `isTie: false → true`.
- `showdown.service.ts:123-125`: a guess to an already-resolved round is not refused (block and message uncovered). `:134`: the "not part of this showdown round" message.
- `bonus.service.ts:169`: `award.reason = category === 'custom' ? trimmedReason : undefined` survives `true`: a non-custom award keeps a stray reason. Assert that editing a non-custom award clears it.

Look equivalent or low value (assert the message, or disable with a reason): the error `name` strings at `showdown.service.ts:13`, `bonus.service.ts:17` and `:25`, and the validation messages at `bonus.service.ts:63` and `:83`.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Comments
