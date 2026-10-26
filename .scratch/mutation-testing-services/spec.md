# Mutation testing: the backend services

Status: ready-for-agent

After the first three backend audits, 113 of the backend's 159 mutable files are in neither mutation run: the DB-free slice (`pnpm --filter backend mutate`) holds 28 and `mutate:db` holds the 20 in `game/state/`. Most of the rest is thin Nest plumbing, but services, the socket layer and the read models hold real rules (standings, stats, team merges, answer handling, live edits), and nothing measures how well they're tested.

## Decisions (2026-10-25)

- **Grow `mutate:db`**, no new command. It already runs every spec against Postgres; the new files join its mutate set and its `reports/stryker-db-incremental.json`.
- **Chosen by role, not by a list.** `stryker.files.cjs` picks the files, so a new service lands in the run without anyone editing a list. In: `*.service.ts`, `game/game.gateway.ts`, the logic modules under `game/socket/`, `game/live-edit/` and `game/rest/`, `ended-sessions-read/`, `standings/cell-points.ts`, `auth/password-hash.ts`, `feedback/feedback-off-reason.ts`. Out: controllers, `*.module.ts`, guards, decorators, everything under `db/` (entities, repositories, seed, `question-payload.ts`), `mikro-orm.config.ts`, the `*-http*.ts` error mappers, Zod `*.schema.ts`/`*.schemas.ts` files, `app.service.ts`/`app.controller.ts`. Files already in the DB-free slice stay there.
- **38 files, about 6.5k lines** on 2026-10-25 (`answer`, `auth` ×4, `bonus`, `ended-sessions-read` ×2, `feedback` ×2, `game.gateway`, `live-edit` ×2, `live-session-rest`, `game/socket` ×7, `import`, `joker`, `league` ×2, `log-buffer`, `media`, `player-count`, `quiz` ×2, `showdown`, `standings` ×2, `stats`, `team` ×3).
- **The baseline runs area by area** with `--mutate <files>`, never one multi-hour run. Incremental results carry over, so the areas add up to the full baseline.
- Carried over from `.scratch/mutation-testing-db/spec.md`: one container per run, one database per worker, a flaky spec is a bug with its own ticket, concurrency capped at 8, and nothing else tests or mutates at the same time.

## Baseline (2026-10-26)

`pnpm --filter backend mutate:db --mutate <files>`, one area at a time, 8 workers, 36 files: every role-picked file on this branch (the rule picks 36 outside `game/state/`; the table has 36, so none is missing, and `cell-points.ts` and `password-hash.ts` are counted in their areas with zero testable mutants). The spec's list of "38" actually sums to 37, and the 37th, `log-buffer.service.ts`, isn't on this branch. Ticket 02 re-ran `standings/` from scratch because the pilot's incremental file wasn't in its worktree. Timeouts are `timeoutFactor: 3`, `timeoutMS: 30000` (see "Timeouts" below). Run time includes the initial run (about 1m30s; `stats.service.ts` alone ran only its 113 related tests, 4s). Compared with ticket 01's extrapolation (about 7 hours), the run took 3h22m: compile errors are about 44% of the mutants and cost nothing. Each area's score counts compile errors out, like the DB spec's table.

| Area | Mutants | Killed | Timeout | Survived | No coverage | Compile errors | Score (all / covered) | Run time |
| ---- | ------- | ------ | ------- | -------- | ----------- | -------------- | --------------------- | -------- |
| standings (2 files) | 184 | 62 | 62 | 11 | 1 | 48 | 91.18% / 91.85% | 9m45s |
| team (3) | 377 | 119 | 35 | 45 | 11 | 167 | 73.33% / 77.39% | 34m43s |
| stats (1) | 198 | 78 | 0 | 4 | 1 | 115 | 93.98% / 95.12% | 1m25s |
| quiz, quiz preview, import (3) | 268 | 105 | 6 | 29 | 5 | 123 | 76.55% / 79.29% | 12m35s |
| ended sessions read (2) | 121 | 52 | 28 | 3 | 0 | 38 | 96.39% / 96.39% | 21m02s |
| league (2) | 223 | 104 | 11 | 21 | 0 | 87 | 84.56% / 84.56% | 18m12s |
| game socket (7) | 243 | 50 | 70 | 7 | 12 | 104 | 86.33% / 94.49% | 41m28s |
| live edit, REST, gateway (4) | 220 | 55 | 17 | 19 | 9 | 120 | 72.00% / 79.12% | 11m36s |
| answer (1) | 103 | 29 | 9 | 9 | 0 | 56 | 80.85% / 80.85% | 11m43s |
| auth (4) | 150 | 47 | 7 | 19 | 0 | 77 | 73.97% / 73.97% | 13m05s |
| showdown, bonus (2) | 197 | 78 | 30 | 20 | 6 | 63 | 80.60% / 84.38% | 16m11s |
| feedback, joker, player count, media (5) | 118 | 39 | 5 | 11 | 0 | 63 | 80.00% / 80.00% | 10m42s |
| **Total (36)** | **2402** | **818** | **280** | **198** | **45** | **1061** | **81.88% / 84.72%** | **3h22m** |

Weakest files: `auth-bootstrap.service.ts` (42.86%), `quiz-edit-change.ts` (53.85%), `media.service.ts` (50%), `team-merge.service.ts` (71%), `team.service.ts` (73%), `showdown.service.ts` (73%), `live-edit.service.ts` (74%), `joker.service.ts` (75%), `auth.service.ts` (77%), `import.service.ts` (67.5%). `answers-updated-payload.util.ts` has one mutant and it is uncovered. `cell-points.ts` and `password-hash.ts` have no testable mutants. Every initial run passed (1116 to 1526 tests) and no spec looked flaky, so there is no flaky-spec ticket.

## Timeouts

The pilot found 131 of 136 detected mutants were timeouts. Why:

- **The default limit is too tight for these specs.** Stryker's limit is `1.5 x net time of the covered tests + 5 s` (plus a small overhead). "Net time" is the test bodies only; each spec file also builds a Nest app and clones a database, which is about 40% on top (initial runs: net 63-69 s, overhead 24-30 s). A mutant covered by 100+ gateway tests runs those files in full and overruns the limit even when every test passes, so a survivor is recorded as a timeout. That hid survivors: on `standings` the default settings found 1 survivor and the final ones 11, on `league-table.service.ts` 0 against 4 (5 at 5x / 120 s, below).
- **Most timeouts are not hangs.** Of the pilot's 123 timeouts, 62 were `StringLiteral` mutants (error messages, labels), which can't loop. Stryker's Jest runner runs with `bail: false`, so a mutant that breaks a path used by many gateway specs fails every covered test, each waiting for a socket event that never arrives, and the run overruns the limit. Those are real detections. A 5x / 120 s limit confirmed it: `standings` ran past 67 minutes with no result, so the limit was cut back.
- **Experiment** (`league-table.service.ts`, 42 mutants): default limit 15 killed / 27 timeout / 0 survived; 5x / 120 s 36 / 1 / 5 (12m47s); 3x / 30 s 29 / 9 / 4 (10m).

Decision: `stryker.db.config.mjs` now sets `timeoutFactor: 3`, `timeoutMS: 30000`, and writes to `reports/stryker-db-incremental-v2.json`, so results recorded under the old limit aren't reused. A first pass over all 36 files with the default limit took 2h45m and reported 789 timeouts and 93 survivors (89.76% / 92.86%); the table above is the second pass, which found 198 survivors. The 280 timeouts left can still hide survivors (one of the five in the experiment), so a mutant that is the only thing between a gap and a green run is worth a one-file run with `--timeoutMS 120000 --timeoutFactor 5`. The earlier `game/state/` baseline (`.scratch/mutation-testing-db/spec.md`) used the default limit, so its 459 timeouts probably hide survivors too: ticket 11.

## Tickets

1. Widen `mutate:db` to the services and pilot one area (`issues/01-widen-mutate-db-and-pilot.md`).
2. Baseline the remaining areas and write survivor tickets (`issues/02-baseline-and-survivor-tickets.md`).
3. Team, team merge and team history (`issues/03-team-survivors.md`).
4. Showdown and bonus awards (`issues/04-showdown-and-bonus-survivors.md`).
5. League, standings, stats and ended sessions (`issues/05-league-standings-and-stats-survivors.md`).
6. Quiz, import and media (`issues/06-quiz-import-and-media-survivors.md`).
7. Answer, joker, player count and feedback (`issues/07-answer-joker-and-feedback-survivors.md`).
8. Auth (`issues/08-auth-survivors.md`).
9. Live edit, live-session REST and the gateway (`issues/09-live-edit-and-rest-survivors.md`).
10. Game socket helpers (`issues/10-game-socket-survivors.md`).
11. Re-baseline `game/state/` under the new timeout (`issues/11-rebaseline-game-state.md`).

Files with no survivors and no uncovered mutants (`session-display-name.ts`, `feedback-off-reason.ts`, `guarded-dispatch.util.ts`, `quiz-preview.service.ts`) need no ticket.
