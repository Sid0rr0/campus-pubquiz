# 11: Backend stats, team history and league calculations

Status: ready-for-agent

Blocked by: None

| File (`apps/backend/src/`)     | Survived | No coverage | Killed |
| ------------------------------ | -------- | ----------- | ------ |
| `stats/session-brief.calc.ts`  | 65       | 12          | 223    |
| `stats/session-detail.calc.ts` | 33       | 0           | 125    |
| `team/team-history.calc.ts`    | 15       | 1           | 19     |
| `stats/session-feedback.calc.ts` | 9      | 0           | 31     |
| `stats/player-count.calc.ts`   | 5        | 0           | 4      |
| `league/league-table.calc.ts`  | 4        | 1           | 39     |
| `league/venue-date.ts`         | 1        | 4           | 0      |

Examples:

- `session-brief.calc.ts:74-75`: ordinal suffixes (`11th`–`13th`, `st`/`nd`/`rd`) aren't covered.
- `session-detail.calc.ts:148-150`: the fastest-answer tiebreak (lower `responseMs`, then team name) survives `<` → `<=` and being forced to `true`.
- `team-history.calc.ts:53`: the empty-values `null` can be dropped. `:84-85`: the `maxPoints > 0` filter survives `>=` and `true`, so a zero-point night isn't tested.

Priority: low. These are reads after the night, not live play.

## Decisions (2026-10-23)

- Priority: low (post-night reads). No open choices.

Done when the per-file run (spec.md, "How to work an issue") on every file this ticket names shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason.
