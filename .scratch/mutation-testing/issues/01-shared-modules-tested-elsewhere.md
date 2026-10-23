# 01: Decide how to treat shared/types modules that only other workspaces test

Status: done

Blocked by: None

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

## Decision (2026-10-23)

**(a)**, now a rule in CODING_STANDARDS "Tests". A search of every workspace's specs for each module's exported names found no direct test for `control-availability`, `session-display-screen`, `leaderboard-board`, `dry-run-press`, `team` (`teamMergeRefusalReason`) or `feedback-rounds`. They only run as a side effect of other tests, so "covered elsewhere" didn't hold.

- Write a direct spec in `shared/types/src/__tests__/` for each module with behaviour, in this order: `control-availability`, `session-display-screen`, `leaderboard-board`, `dry-run-press`, `team`, `feedback-rounds`, `admin-view-flags`, `kahoot-visibility`, `team-presence`. Use `game-state-fixtures.ts` for sessions.
- Leave `answers.ts`, `game-state-types.ts` and `showdown-guesses-pending-error.ts` as they are (a constant and error classes). Accept their few survivors; don't exclude them from `mutate`.
- Done when `pnpm --filter @campus-pubquiz/types mutate` shows kills in every listed module and no "no coverage" left in them.
