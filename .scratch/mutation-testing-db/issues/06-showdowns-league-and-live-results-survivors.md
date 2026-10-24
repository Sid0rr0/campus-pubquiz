# 06: Showdowns, league and live results

Status: ready-for-agent

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
