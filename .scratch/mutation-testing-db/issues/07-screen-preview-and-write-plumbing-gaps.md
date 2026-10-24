# 07: Screen preview, game-state service and session-write gaps

Status: done

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

## Comments

Done: all three files show 0 survived and 0 no-coverage. New specs: `screen-preview.spec.ts` (round overview, joker pick, join overlay, break review, break round title and the fallbacks), extra headings and bodies in `presenter-context.spec.ts`, and in `session-write.spec.ts` the held-writer guards, the deadline-without-outcome guard, the standings-step skip, the sorted hold order, the rename-races-close catch, join refusal rethrow and the blank-screen warning. `league-tables-changed.spec.ts` now covers the league-top refresh log and the closed-meanwhile skip. The run also showed survivors the ticket did not list (league top catch, join refusal rethrow, `onBlankScreen`, sort order, standings gate): all killed by specs. Disabled with a reason: the three unreachable error-message fallbacks at `game-state.service.ts` (join, admin action, bonus edit). The `onBlankScreen` message turned out reachable via `SessionWrite.place`, so it is tested, not disabled.
