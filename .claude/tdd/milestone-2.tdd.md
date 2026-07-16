# TDD Evidence Report: Milestone 2 — Playable Quiz

**Source plan:** `/ecc:plan "plan milestone 2"` — an 8-phase inline plan (not a `*.plan.md` artifact), confirmed by the user with "yes". Phases: (1) shared/types contract extension, (2) DB seeding infrastructure, (3) team join + admin auth guard, (4) AnswerService + SUBMIT_ANSWER, (5) grading + leaderboard, (6) restart resilience, (7) frontend UI for answers/grading/leaderboard, (8) full verification + evidence report.

## User Journeys

1. As a team on their phone, I want to join a game session with a team name (and rejoin with my stored token after a refresh) so my identity survives reconnects.
2. As a team, I want to submit an answer to the open question, with my most recent submission always winning if I change my mind before the question locks.
3. As the quiz master, I want to see every team's live answer for the current question and award points per answer.
4. As the quiz master and every connected client, I want the leaderboard to reflect real graded scores, not a placeholder.
5. As the quiz master, I want the game to survive a backend restart without losing where we were in the quiz — the in-memory game state must be rebuildable from Postgres.
6. As a developer, I want the backend and frontend to each use one consistent import convention (`@/*` absolute paths) rather than a mix of relative depths.

## Task Report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| `shared/types` contract | `SOCKET_EVENTS`/payload types for join, submit, grade, answers-updated, leaderboard | `pnpm --filter @campus-pubquiz/types test` | PASS, 20/20 |
| DB seeding (`SeedService`, `DbModule`) | Idempotent startup seed from a hardcoded fixture, real Postgres UUIDs, join-code generation | `npx jest seed.service.spec.ts join-code.util.spec.ts` (testcontainers) | PASS |
| `TeamService` + admin guard | Join/rejoin-by-token, duplicate-name rejection; `GameGateway` admin handshake password check | `npx jest team.service.spec.ts game.gateway.spec.ts` | PASS |
| `AnswerService` + `SUBMIT_ANSWER` | Last-write-wins upsert on `(session, question, team)`; gateway broadcasts `ANSWERS_UPDATED` to admin only, acks the submitter with `ANSWER_RECEIVED` | `npx jest answer.service.spec.ts game.gateway.spec.ts` (testcontainers + mocked gateway) | PASS |
| Grading + leaderboard | `AnswerService.grade`/`computeLeaderboard` (ungraded = 0 points, teams with zero graded answers still rank); `GRADE_ANSWER` handler re-broadcasts answers to admin and `STATE_UPDATED` (with leaderboard) to all rooms | `npx jest answer.service.spec.ts game-state.service.spec.ts game.gateway.spec.ts` | PASS |
| Restart resilience | `GameProgressRepository` persists/reloads `GameProgress` against `game_sessions`; `GameStateService.onModuleInit` rehydrates instead of defaulting to lobby; `applyAction`/`handleAdminAction` made async to await the write | `npx jest game-progress.repository.spec.ts game-state.service.spec.ts` (testcontainers) | PASS |
| Backend import convention | All relative `./`/`../` imports rewritten to `@/*`; `tsconfig.build.json` `rootDir` bug fixed; Jest `moduleNameMapper` added (empirically required) | `pnpm --filter backend build && node dist/main` (boots, DI resolves, fails only on `ECONNREFUSED` — no live Postgres in this environment) | PASS |
| `useGameSocket` hook | Extended with `team`/`joinTeam`, `submitAnswer`, `liveAnswers`, `gradeAnswer` | `npx vitest run app/lib/use-game-socket.test.ts` | PASS, 11/11 |
| `PlayPage` | Dispatches `joinTeam` on submit and on reconnect (with stored token); renders a free-text input or multiple-choice buttons gated on an open question **and** a confirmed team identity | `npx vitest run app/play/page.test.tsx` | PASS, 12/12 |
| `AdminPage` | Live-answers panel with a points input + Grade button per ungraded answer (graded ones show their points instead); leaderboard preview | `npx vitest run app/admin/page.test.tsx` | PASS, 13/13 |
| `DisplayPage` | Renders ranked leaderboard entries (shared `Leaderboard` component) instead of a bare heading | `npx vitest run app/display/page.test.tsx` | PASS, 8/8 |
| Frontend import convention | Wired the existing `tsconfig.json` `@/*` alias into `vitest.config.ts` via `resolve.alias` (no new dependency); converted all relative imports and `vi.mock` specifiers | `npx next build` (all 3 routes compile) | PASS |

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Startup seed creates the hardcoded quiz on first boot and is idempotent (reuses the existing session) on subsequent boots, preserving content and assigning real DB UUIDs | `apps/backend/src/db/seed.service.spec.ts` | integration (testcontainers) | PASS |
| 2 | `TeamService.join` creates a new team with a generated token, restores the same team by token, rejects a duplicate name within a session, and allows the same name across different sessions | `apps/backend/src/team/team.service.spec.ts` | integration | PASS |
| 3 | Only a client in the `admin` room may connect with a correct `ADMIN_PASSWORD`; wrong/missing password disconnects | `apps/backend/src/game/game.gateway.spec.ts` | unit (mocked socket) | PASS |
| 4 | `JOIN_PLAYERS` joins a team and emits `JOIN_ACCEPTED`; rejected from non-players clients; a join error surfaces as `WsException` | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 5 | `AnswerService.submit` creates an ungraded answer, overwrites the same team+question's prior answer (last-write-wins), and leaves other teams' answers untouched | `apps/backend/src/answer/answer.service.spec.ts` | integration | PASS |
| 6 | `SUBMIT_ANSWER` is rejected from non-players clients; on success it acks the submitter with `ANSWER_RECEIVED` and broadcasts `ANSWERS_UPDATED` to the admin room only | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 7 | `AnswerService.grade` updates `pointsAwarded`/`gradedAt` and returns the owning `questionId`; `computeLeaderboard` sums graded points per team (descending, ties broken by name), treating ungraded answers and answer-less teams as zero | `apps/backend/src/answer/answer.service.spec.ts` | integration | PASS |
| 8 | `GRADE_ANSWER` is admin-only; on success it re-broadcasts `ANSWERS_UPDATED` for the graded question to admin and `STATE_UPDATED` (carrying the refreshed leaderboard) to all three rooms | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 9 | `GameStateService.setLeaderboard`/`getSnapshot` cache and return the leaderboard synchronously (no async plumbing needed in the gateway's hot broadcast path) | `apps/backend/src/game/game-state.service.spec.ts` | unit | PASS |
| 10 | `GameProgressRepository.save`/`load` round-trip `GameProgress` against real Postgres, default to lobby for a freshly seeded session, and return `null` for a nonexistent session | `apps/backend/src/game/game-progress.repository.spec.ts` | integration | PASS |
| 11 | `GameStateService.onModuleInit` rehydrates progress from the repository instead of defaulting to lobby when a saved state exists; `applyAction` persists after every transition | `apps/backend/src/game/game-state.service.spec.ts` | unit (mocked repository) | PASS |
| 12 | `useGameSocket.joinTeam` emits `JOIN_PLAYERS`; the hook adopts `JOIN_ACCEPTED` into `team`; `submitAnswer`/`gradeAnswer` emit the matching events; `liveAnswers` adopts `ANSWERS_UPDATED` | `apps/frontend/app/lib/use-game-socket.test.ts` | unit (mocked `socket.io-client`) | PASS |
| 13 | `PlayPage` dispatches `joinTeam` on both form-submit and stored-credential reconnect; renders (and submits from) a free-text input or multiple-choice buttons only once a question is open **and** the team identity is confirmed; hides the form while locked | `apps/frontend/app/play/page.test.tsx` | component | PASS |
| 14 | `AdminPage` renders live answers with a grade control per ungraded answer (calling `gradeAnswer` with the entered points) and shows awarded points instead of a control once graded; renders a leaderboard preview from the snapshot | `apps/frontend/app/admin/page.test.tsx` | component | PASS |
| 15 | `DisplayPage` renders ranked leaderboard entries via the shared `Leaderboard` component whenever the snapshot's `isLeaderboardVisible` flag is set | `apps/frontend/app/display/page.test.tsx` | component | PASS |

## Coverage and Known Gaps

- **`shared/types`**: 20/20 tests pass (unchanged from Milestone 1; Milestone 2 added no new shared-types logic beyond payload/event type declarations, which don't need runtime tests).
- **`apps/backend`** (`npx jest --coverage`): 58/58 tests pass. Feature code (`src/answer`, `src/game`) is 100% statements/lines, 83–84% branches. Overall repo coverage (85.6% statements / 79% branches / 84.7% functions / 85.65% lines) is pulled down by `main.ts`, `app.module.ts`, and `db.module.ts` (0%, framework bootstrap/DI wiring with no branching logic) — same accepted gap as Milestone 1, smoke-tested by `test/app.e2e-spec.ts`.
- **`apps/frontend`** (`npx vitest run --coverage`): 44/44 tests pass, 98.59% statements, 89.69% branches, 100% functions, 98.59% lines — all above the 80% threshold.
- **Deliberately out of scope**: Google Sheets import, media rounds beyond the existing `mediaUrl` render, and a Redis/multi-instance adapter (explicitly rejected by `CLAUDE.md`'s "Known Tradeoffs" at pub-quiz scale).
- **Verified but not container-tested end-to-end**: `node dist/main` boots the compiled backend, resolves all providers (including the new `AnswerService`/`GameProgressRepository`), and maps all four gateway message handlers (`admin_action`, `join_players`, `submit_answer`, `grade_answer`); it fails only on `ECONNREFUSED` since no live Postgres runs in this environment. The exact same schema and migrations are exercised end-to-end by the testcontainers integration suite, which is treated as the DB-correctness evidence rather than standing up `docker-compose` for this report.

## Merge Evidence

Checkpoint commits on `main` since the Milestone 1 evidence report (`1a39d5f`), in order (RED→GREEN→refactor per stage, scoped Conventional Commits):

```
1315d5b test(shared-types): add reproducer for Milestone 2 socket events
efc40be feat(shared-types): add Milestone 2 events, payloads, and leaderboard
e856701 fix(backend): satisfy extended StateSnapshotPayload with a leaderboard stub
078a0ba test(backend): add reproducer for join code generator
50ae136 feat(backend): implement join code generator
0096f3d feat(backend): implement SeedService and DbModule
959faa2 test(backend): redesign GameStateService tests for SeedService injection
3981229 feat(backend): source GameStateService from SeedService (real DB UUIDs)
7d452b8 feat(backend): wire DbModule and SeedService into AppModule
3e7658f test(backend): add reproducer for TeamService join/rejoin
f30f270 feat(backend): implement TeamService
5601e1f test(backend): add reproducer for GameStateService.getGameSessionId
ba39fe4 feat(backend): add GameStateService.getGameSessionId()
f9c3044 test(backend): add reproducer for admin handshake guard and JOIN_PLAYERS
f617c4b feat(backend): implement admin handshake guard and JOIN_PLAYERS
9bfa722 refactor(backend): use @/ absolute imports instead of relative paths
2092110 test(backend): add reproducer for AnswerService submit/list behavior
3369afa feat(backend): implement AnswerService with last-write-wins upsert
0a7c151 test(backend): add reproducer for SUBMIT_ANSWER gateway handler
1cdb03f feat(backend): wire SUBMIT_ANSWER handler into GameGateway
ef5f90d test(backend): add reproducer for AnswerService grade + leaderboard
642a0ba feat(backend): implement AnswerService grading and leaderboard computation
3cf763e test(backend): add reproducer for GameStateService leaderboard cache
0e970d0 feat(backend): replace leaderboard stub with a settable in-memory cache
f8a8138 test(backend): add reproducer for GRADE_ANSWER gateway handler
00155d3 feat(backend): wire GRADE_ANSWER handler into GameGateway
14e83df test(backend): add reproducer for GameProgress persistence and rehydration
de6ad4c feat(backend): persist and rehydrate GameProgress for restart resilience
19e79db test(backend): add Postgres integration coverage for GameProgressRepository
27451ba test(frontend): add reproducer for join/submit/grade socket hook capabilities
5167c93 refactor(frontend): use @/ absolute imports instead of relative paths
d0ef9fb refactor(frontend): convert remaining vi.mock relative path specifiers
eae2750 test(frontend): add reproducer for PlayPage join dispatch and answer form
39046d7 feat(frontend): implement PlayPage join dispatch and answer submission
123e4ca test(frontend): add reproducer for AdminPage grading panel and leaderboard
a9873fb feat(frontend): implement AdminPage grading panel and leaderboard preview
a384db5 test(frontend): add reproducer for DisplayPage leaderboard entry rendering
5fd54fe refactor(frontend): extract shared Leaderboard component
```
