# 06: Showdowns, league and live results

Status: done

Blocked by: None

**Type:** task

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `showdowns-changes.ts` | 3 | 4 |
| `league-changes.ts` | 5 | 1 |
| `live-results-read.ts` | 1 | 0 |

Look like real gaps:

- `showdowns-changes.ts:60`: the "your team is not part of this showdown round" guard can be removed or inverted. `:112-113`: the `InvalidShowdownError` → `SessionRefusal` mapping has no coverage at all.
- `league-changes.ts:88`: `assertSessionAssignable` can be skipped when `leagueIds` is given; `:95` (`partial` non-empty `||` no `leagueIds`) survives `&&`, `false ||`, `>= 0` and `!leagueIds → leagueIds`. Needs specs for league-only, partial-only and both changes.

Look equivalent or low value: `league-changes.ts:37` (log message, no coverage) and `live-results-read.ts:56` (log message). Disable with a reason unless the logger is already asserted elsewhere.

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".

## Comments

Done: all three files show 0 survived and 0 no coverage in their one-file `mutate:db` runs. `showdowns-changes.ts`: specs for the `InvalidShowdownError` to refusal mapping (non-numeric answer, second round in progress) and for an unexpected service error not being passed off as a refusal. The `:60` not-seated guard is disabled with a reason: it is equivalent, because `ShowdownService.submitGuess` refuses an unseated team with the same text and the mapping turns it into the same refusal. `league-changes.ts`: specs for a change carrying both settings and leagues (settings kept across a restart), a refused league leaving no settings stored in the database, a leagues-only change after the quiz started, an empty settings change refused after start, and the league top read failure being logged. The logger label strings are disabled with a reason. `live-results-read.ts`: the read-failure log messages are now asserted in `live-results-placement.spec.ts`; the logger label is disabled with a reason.
