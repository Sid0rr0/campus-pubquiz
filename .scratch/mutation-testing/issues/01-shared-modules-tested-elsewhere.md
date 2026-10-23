# 01: Decide how to treat shared/types modules that only other workspaces test

Status: needs-triage

**Type:** decision

Several `shared/types` modules have no spec in `shared/types/src/__tests__/`. They're only exercised through frontend or backend tests, so Stryker kills nothing in them:

| File                         | Survived | No coverage | Killed |
| ---------------------------- | -------- | ----------- | ------ |
| `leaderboard-board.ts`       | 21       | 50          | 0      |
| `admin-view-flags.ts`        | 28       | 0           | 0      |
| `control-availability.ts`    | 9        | 0           | 0      |
| `kahoot-visibility.ts`       | 7        | 0           | 0      |
| `session-display-screen.ts`  | 7        | 0           | 0      |
| `feedback-rounds.ts`         | 4        | 1           | 0      |
| `team-presence.ts`           | 2        | 0           | 0      |
| `team.ts`, `answers.ts`, `dry-run-press.ts`, `game-state-types.ts`, `showdown-guesses-pending-error.ts` | 1–3 each | | 0 |

Options:

- **(a)** Give each a direct spec in `shared/types`. That fits "shared logic is tested where it lives", and it's the only way Stryker can measure them.
- **(b)** Accept the cross-workspace coverage and exclude these files from `mutate` in `shared/types/stryker.config.mjs`, with a comment naming where they're tested.

Issues 03 and 05 also touch files in this list (`session-display-screen.ts`, `leaderboard-board.ts`). Settle this first.
