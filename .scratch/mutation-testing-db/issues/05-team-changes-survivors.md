# 05: Team roster, player count, feedback and settings

Status: ready-for-agent

Blocked by: None

**Type:** task

| File | Survived | No coverage |
| ---- | -------- | ----------- |
| `team-player-count-changes.ts` | 5 | 1 |
| `team-feedback-changes.ts` | 2 | 0 |
| `team-roster-changes.ts` | 1 | 0 |
| `session-settings-changes.ts` | 1 | 0 |

Look like real gaps:

- `team-player-count-changes.ts:69`: the "team is in the session" check survives `false`, `every`, `some(() => undefined)` and `some(() => false)`; `:75`: `stored !== null` can be `false`/`return false` (one no-coverage). A spec for a team that is only in the store, and one for an unknown team, kills most of them.
- `team-roster-changes.ts:178`: `touchedScores: false → true`.
- `session-settings-changes.ts:85`: `touchedScores: false → true`. Assert `touchedScores` on both.

Look equivalent or low value: `team-feedback-changes.ts:49` and `:64` (`noTeamReason` strings; assert them or disable).

Done when the one-file run (`pnpm --filter backend mutate:db --mutate <file>` for each file above, run one at a time) shows no surviving and no "no coverage" mutants, apart from ones disabled with a `// Stryker disable` reason. Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue".
