# 07: Screen preview, game-state service and session-write gaps

Status: ready-for-agent

Blocked by: None

**Type:** task

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `screen-preview.util.ts` | 3 | 2 |
| `game-state.service.ts` | 0 | 7 |
| `session-write.ts` | 0 | 6 |

Look like real gaps:

- `screen-preview.util.ts`: `round_overview` (`:48`), `break_review` (`:75`) and `break_round_title` (`:84`) cases can be removed with no spec noticing; `:100` and `:109` ("Revealing answers" heading) have no coverage.
- `game-state.service.ts:256-258`: the catch that swallows an error only when the session write has closed has no coverage (3 mutants). Worth a spec: it is the race the comment describes.
- `session-write.ts:217-224`: the "held writer used after release" and "join code not part of the hold" guards have no coverage (4 mutants); `:67-69` the "moved an auto-lock deadline but returned no SessionOutcome" guard too (2).

Look equivalent or low value: error-message strings at `game-state.service.ts:462`, `:489`, `:579`, `:656` (all unreachable defensive branches). Disable with a reason rather than forcing them.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".
