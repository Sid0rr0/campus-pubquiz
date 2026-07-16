# TDD Evidence Report: Milestone 1 — Live Loop

**Source plan:** none — journeys derived during this TDD run from `CLAUDE.md`'s First Milestone list and conversation-clarified requirements (round-grouped breaks, leaderboard-as-toggle, round `breakAfter` configurability).

## User Journeys

1. As the quiz master, I want the game to move through a well-defined sequence (lobby → question → locked → grading break → reveal → ended) so that the flow is predictable and can't skip steps.
2. As the quiz master, I want breaks/grading to happen after a configurable group of rounds (not hardcoded to a fixed count) so different quiz formats don't require code changes.
3. As the quiz master, I want to show the leaderboard at any moment without disturbing the underlying game state, so hiding it resumes exactly where things were.
4. As any connecting client (display/admin/players), I want to receive the full current state on connect so a phone sleeping or a page refresh doesn't lose sync.
5. As a client, I want only admin actions to change the game state, so display screens and team phones can never accidentally advance the quiz.
6. As a developer, I want the DB schema to actually enforce the data model (FKs, last-write-wins) against a real Postgres, not just compile.
7. As the quiz master, admin, and a team, I want three working pages that reflect the live state in real time.

## Task Report

| Task | Summary | Validation command | Result |
|---|---|---|---|
| `shared/types` state machine | Pure `getNextGameState` covering all transitions, round grouping, leaderboard toggle | `pnpm --filter @campus-pubquiz/types test:coverage` | PASS, 20/20, 100% coverage |
| `shared/types` socket events | Pinned `SOCKET_EVENTS`/`SOCKET_ROOMS` strings + payload types | (same command, included above) | PASS |
| Drizzle schema | `Quiz/Round/Question` + `GameSession/Team/Answer`, `breakAfter`, last-write-wins unique index | `npx jest schema.integration.spec.ts` (real `postgres:16-alpine` via testcontainers) | PASS, 4/4 |
| `GameStateService` | Wraps the shared state machine with an in-memory hardcoded quiz fixture | `npx jest game-state.service.spec.ts --coverage` | PASS, 9/9, 100%/100%/100%/83% |
| `GameGateway` | Room assignment, reconnect snapshot, admin-only guard, broadcast | `npx jest game.gateway.spec.ts --coverage` | PASS, 15/15 (incl. GameStateService), 100%/85%/100%/100% |
| `useGameSocket` hook | Adopts snapshots, surfaces exceptions, emits actions, disconnects on unmount | `npx vitest run app/lib/use-game-socket.test.ts` | PASS, 6/6 |
| `DisplayPage` | Renders every status + leaderboard overlay | `npx vitest run app/display/page.test.tsx` | PASS, 7/7 |
| `AdminPage` | Renders status/question/error, all 6 action buttons wired | `npx vitest run app/admin/page.test.tsx` | PASS, 9/9 |
| `PlayPage` | Join gate (localStorage), reconnect skip, read-only question mirror | `npx vitest run app/play/page.test.tsx` | PASS, 5/5 |

## Test Specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Full happy path lobby→question_open→locked→break→reveal→ended transitions correctly | `shared/types/src/game-state.test.ts` | unit | PASS |
| 2 | `NEXT_QUESTION`/`ADVANCE` loops back to `question_open` when a round has more questions, or the next round when finished with no break | `shared/types/src/game-state.test.ts` | unit | PASS |
| 3 | A round finishing with `breakAfter: true` enters `break`; grading happens there (no separate grading state) | `shared/types/src/game-state.test.ts`, `apps/backend/src/game/game-state.service.spec.ts` | unit | PASS |
| 4 | `TOGGLE_LEADERBOARD` flips `isLeaderboardVisible` without touching `status`, from any state including `ended` | `shared/types/src/game-state.test.ts` | unit | PASS |
| 5 | Illegal transitions (wrong action for current status) throw `IllegalGameTransitionError` | `shared/types/src/game-state.test.ts` | unit | PASS |
| 6 | A quiz config where the last round has `breakAfter: false` throws `InvalidQuizConfigError` (answers could never be revealed) | `shared/types/src/game-state.test.ts` | unit | PASS |
| 7 | Postgres schema round-trips the full authoring chain (quiz→round→question) and runtime chain (session→team→answer) | `apps/backend/src/db/schema.integration.spec.ts` | integration (real Postgres via testcontainers) | PASS |
| 8 | FK constraint rejects an answer referencing a nonexistent team | `apps/backend/src/db/schema.integration.spec.ts` | integration | PASS |
| 9 | `onConflictDoUpdate` on `(session, question, team)` implements last-write-wins answer revision | `apps/backend/src/db/schema.integration.spec.ts` | integration | PASS |
| 10 | A connecting client is joined to the room matching its declared role and immediately receives a full state snapshot (reconnect support) | `apps/backend/src/game/game.gateway.spec.ts` | unit (mocked socket) | PASS |
| 11 | A client connecting with no role, or an unrecognized role, is disconnected | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 12 | Only a client in the `admin` room may dispatch an action; others get a `WsException` and no broadcast occurs | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 13 | An admin action's result is broadcast to all three rooms (display/admin/players) | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 14 | An illegal admin action surfaces as a `WsException` to the caller without broadcasting | `apps/backend/src/game/game.gateway.spec.ts` | unit | PASS |
| 15 | `useGameSocket` adopts `STATE_SYNC`/`STATE_UPDATED` payloads, turns an `exception` event into `connectionError`, and disconnects on unmount | `apps/frontend/app/lib/use-game-socket.test.ts` | unit (mocked `socket.io-client`) | PASS |
| 16 | `DisplayPage` renders the correct message/question for every status, and the leaderboard overlay takes priority regardless of status | `apps/frontend/app/display/page.test.tsx` | component | PASS |
| 17 | `AdminPage` shows status/current question/connection error, and each of the 6 buttons dispatches the matching `GameAction` | `apps/frontend/app/admin/page.test.tsx` | component | PASS |
| 18 | `PlayPage`'s join gate persists a team name to `localStorage`; a stored name skips the form on reconnect; the joined view mirrors the live question and leaderboard | `apps/frontend/app/play/page.test.tsx` | component | PASS |

## Coverage and Known Gaps

- **`shared/types`**: `pnpm --filter @campus-pubquiz/types test:coverage` → 100% statements/branches/functions/lines (20/20 tests).
- **`apps/backend`** (`npx jest --testPathPatterns='src/' --coverage`): 20/20 tests pass. `src/game/*` (the feature code) is 100% statements/functions/lines, 85% branches. Overall repo statement coverage is 79% (just under an 80% target) — pulled down entirely by `main.ts` and `app.module.ts` (0%, framework bootstrap/wiring with no branching logic to test) and a few uncovered `relations()` lines in `schema.ts`. The e2e boot test (`test/app.e2e-spec.ts`) exercises both files at the smoke-test level and passes. Two intentionally-uncovered defensive branches: `GameStateService`'s out-of-range fixture-index fallback and `GameGateway`'s non-`Error` catch branch — both guard against states the code's own invariants make unreachable.
- **`apps/frontend`** (`npx vitest run --coverage`): 27/27 tests pass, 96% statements, 82.5% branches, 100% functions, 96% lines — all above the 80% threshold. Remaining uncovered branches are alternate question-type rendering paths (e.g., `DisplayPage`/`PlayPage` don't have a test for every question type simultaneously; `useGameSocket`'s exception-payload-without-`message` fallback).

## Deliberate Scope Boundary

`PlayPage` intentionally does **not** submit answers yet. `GameGateway` only handles `ADMIN_ACTION` — `SUBMIT_ANSWER` and `JOIN_PLAYERS` have shared event names and payload types defined but no server-side handler. This matches `CLAUDE.md`'s own milestone ordering ("grading UI comes after the live loop works end-to-end"): this milestone proves the round-aware state machine, persistence schema, and realtime broadcast/reconnect loop across all three rooms. Team answer submission, persisted-answer wiring, and the Sheets import are follow-up work.

## Merge Evidence

Checkpoint commits on `main` (RED→GREEN→refactor per stage, scoped Conventional Commits):

```
9f9c334 feat(frontend): implement useGameSocket hook
541859e feat(frontend): implement PlayPage
0c3f988 test(frontend): add reproducer for PlayPage
b9350af feat(frontend): implement AdminPage, fix RTL cleanup between tests
55ffdbe test(frontend): add reproducer for AdminPage
c40c1ed feat(frontend): implement DisplayPage
05342a8 test(frontend): add reproducer for DisplayPage
d5a4267 test(frontend): add reproducer for useGameSocket hook
66aa343 docs(repo): adopt Conventional Commits with scope, refresh state machine docs
f8e7d42 feat: implement GameGateway with room-based broadcast and admin guard
cfd2c9f feat: implement GameStateService over the shared state machine
6294d34 test: add reproducer for GameStateService with hardcoded quiz fixture
c996127 feat: add Drizzle Postgres schema for Quiz/Round/Question + GameSession/Team/Answer
4d82967 feat: add socket event names and payload types to shared/types
68a6f15 feat: implement round-aware game state machine
e06a14e test: redesign game state machine tests for round-grouped breaks
d1bcccb test: add reproducer for game state machine transitions
```
