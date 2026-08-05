# TDD Evidence Report: Milestone 4, Phase 2 — `GameStateService` → per-session state

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 2 of 6 ("`GameStateService` → per-session
state"), flagged in the plan as the highest-regression-risk phase since it touches
nearly every method on `GameStateService` and every call site in `GameGateway`.
Scope per the plan: replace the service's scalar fields (`progress`, `seededGame`,
`teams`, `leaderboard`, `connectedTeamSockets`, `answeredTeamIdsByQuestion`,
`leaderboardRevealCount`) with a `Map<joinCode, SessionState>`; every public
method takes `joinCode` as its first argument; `selectQuiz` is replaced by
`createSession(quizId)`, which allocates a **new** session instead of overwriting
the current one. Room-scoping the gateway's Socket.IO rooms themselves is Phase 3
— out of scope here.

## User journeys

1. As a backend developer implementing Phase 3 (gateway room scoping), I want
   `GameStateService` to already hold N independent sessions in a `Map`, so
   Phase 3 only has to change which `joinCode` each socket connection resolves
   to, not the state layer underneath.
2. As today's single quiz-night operator, I want the existing single-session
   admin/display/play flow to keep working exactly as before, so this internal
   refactor is invisible until Phase 4/5 exposes real session picking.
3. As a backend developer, I want `createSession(quizId)` to allocate a
   genuinely new session (own joinCode, own lobby state, own team roster) that
   coexists with whatever session was previously active, so two quiz nights
   can eventually run side by side without one's game state leaking into the
   other's.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 2 | `GameStateService` rewritten around `Map<joinCode, SessionState>`; `GameGateway`, `QuizController`, `ImportService` call sites updated to resolve `getDefaultJoinCode()` until Phase 3 wires real per-connection session selection; 8 spec files migrated to the joinCode-taking API | `pnpm --filter backend test`, `pnpm --filter backend lint` (`tsc --noEmit` + `eslint --fix`), `pnpm --filter backend build` | PASS (304/304 tests, 40/40 suites, 0 lint errors, build green) |

### RED

The prior session had already committed the RED half of this phase as an
uncommitted reproducer in `core-snapshot.spec.ts`: it called
`service.getDefaultJoinCode()`, `service.applyAction(joinCode, ...)`,
`service.getGameSessionId(joinCode)`, `service.getSnapshot(joinCode)`,
`service.setTeams(joinCode, ...)`, and `service.createSession(2)` — none of
which existed yet on `GameStateService` (still single-session, zero-arg
`selectQuiz`/`getSnapshot`/etc.). Running it against the untouched service
failed genuinely:

```
● GameStateService — core snapshot › throws if used before onModuleInit resolves the seeded game
● GameStateService — core snapshot › exposes the seeded game session id
● GameStateService — core snapshot › includes the session join code in the snapshot
● GameStateService — core snapshot › summarizes the active quiz structure (blocks and topics per block) in the snapshot
● GameStateService — core snapshot › starts with no connected teams in the snapshot
● GameStateService — core snapshot › reflects teams set via setTeams in the snapshot
● GameStateService — core snapshot › clears the connected teams when a new quiz session is selected

TypeError: service.getDefaultJoinCode is not a function

Test Suites: 1 failed, 1 total
Tests:       7 failed, 7 total
```

This session picked up from that RED state.

### GREEN

Implemented, in order:

1. **`game-state.service.ts`** — introduced a private `SessionState` interface
   (`seededGame`, `progress`, `questionLockAt`, `leaderboard`,
   `leaderboardRevealCount`, `teams`, `answeredTeamIdsByQuestion`,
   `connectedTeamSockets`) and a `Map<string, SessionState>` keyed by
   joinCode, plus a `defaultJoinCode` pointer. Every public method now takes
   `joinCode` as its first argument (`getGameSessionId`, `getActiveQuizId`,
   `reloadActiveQuiz`, `setLeaderboard`, `setTeams`, `getConnectedSocketId`,
   `setTeamConnected`, `clearTeamConnectionBySocketId`, `setAnsweredTeamIds`,
   `isQuestionOpenForAnswering`, `getSnapshot`, `getQuestionLockAt`,
   `applyAction`, `getAdminQuestionContext`). `selectQuiz(quizId)` is replaced
   by `createSession(quizId)`, which allocates a brand-new session/joinCode
   (keeping any other session's state untouched) and becomes the new default.
   Mutations replace the session's map entry with a new object rather than
   mutating fields in place, matching the codebase's immutable-update
   convention. Private helpers (`getContext`, `getCurrentQuestion`,
   `getBlockSeededQuestions`, etc.) now take a `SessionState` parameter
   instead of reading `this.*` scalars.
2. **`getDefaultJoinCode()`** (new) — the session single-session call sites
   (gateway, `QuizController`, `ImportService`) resolve until Phase 3/5 thread
   a real per-connection joinCode through. Points at the most recently
   created/initialized session, so today's single-session UX is unchanged.
3. **`game.gateway.ts`** — every handler resolves
   `const joinCode = this.gameState.getDefaultJoinCode();` once and threads
   it into subsequent `GameStateService` calls; `handleSelectQuiz` now calls
   `this.gameState.createSession(payload.quizId)` instead of `selectQuiz`.
   No socket event names, payload shapes, or room membership changed — this
   phase is an internal call-site update, not the room-scoping work (Phase 3).
4. **`quiz.controller.ts`**, **`import.service.ts`** — the two non-gateway
   call sites (`GET /quizzes`'s `activeQuizId`, `ImportService.confirm()`'s
   in-progress/active-quiz checks) updated the same way.
5. **Eight `__tests__` spec files** that construct `GameStateService`
   directly migrated to the joinCode-taking API: `admin-question-context`,
   `leaderboard`, `state-transitions`, `question-lock-countdown`,
   `team-presence`, `block-questions-and-response-indicators`, and
   `persistence-and-quiz-selection` (`core-snapshot` was the RED file from
   the prior session). `question-lock-auto-advance.spec.ts` needed no edits —
   it only calls `gateway.handle*`, never `GameStateService` directly.
   `quiz-selection.spec.ts` (gateway-level `SELECT_QUIZ` test) needed no
   edits either — it asserts on `seedService.createSession`, not
   `gameState.selectQuiz`/`createSession`.
6. **Two unit-test mocks** (`quiz.controller.spec.ts`, `import.service.spec.ts`)
   gained a `getDefaultJoinCode` stub so their existing `GameStateService`
   fakes satisfy the new call added inside `QuizController.list()` /
   `ImportService.confirm()`.

Full run after implementation:

```
Test Suites: 40 passed, 40 total
Tests:       304 passed, 304 total
Snapshots:   0 total
```

`eslint --fix` cleared 8 prettier-only formatting diffs (line wrapping from
the mechanical joinCode-threading edits); zero errors remained after.
`tsc --noEmit` and `nest build` both clean; a workspace-wide
`pnpm --filter backend build` also built the frontend successfully (no
cross-workspace breakage — `shared/types` is untouched by this phase).

### Refactor

None needed beyond what's described above — `computeQuestionLockAt` and
`computeLeaderboardRevealCount` were extracted as pure functions (taking
`progress`/`action`/`leaderboard` explicitly) rather than kept as
`this`-mutating private methods, since session state is now replaced
immutably per mutation rather than field-by-field.

## Design decisions worth recording

- **`createSession` still gates on the *default* session's status.** The plan
  says `createSession` "allocates a new joinCode/state entry instead of
  overwriting the current one" — true here: the old session's `SessionState`
  stays in the `Map`, untouched. But `createSession` still throws unless the
  *default* session is in `lobby`/`ended`, matching every existing
  single-session gateway test (`quiz-selection.spec.ts`: "surfaces a mid-game
  quiz selection as a WsException"). This is a deliberate interim rule, not
  the final multi-session creation policy — Phase 4's admin session-lifecycle
  surface (open question #1/#2 in the plan) is where "can I start session B
  while session A is mid-game" gets a real answer.
- **`getDefaultJoinCode()` follows the most-recently-created session.**
  `createSession` reassigns `defaultJoinCode` to the new session (mirroring
  the old `selectQuiz`'s "replace the current game" behavior for gateway
  purposes), while the *old* session's `SessionState` is kept in the map
  rather than discarded. This is what lets today's admin "select a new quiz"
  flow keep working unchanged through the gateway (Phase 3 will replace
  `getDefaultJoinCode()` call sites with real per-connection resolution) while
  still being structurally ready for Phase 4/5 to let multiple sessions run
  concurrently.
- **`getSession(joinCode)` distinguishes "never initialized" from "unknown
  joinCode."** `onModuleInit` not having resolved yet throws "used before
  initialization" (matches the pre-existing contract); a genuinely unknown
  joinCode against an initialized service throws a distinct "Unknown game
  session" error — new, unexercised until Phase 3 needs to reject a socket
  handshake with a bad `?code=`.
- **Three spec-file semantics changed from "mutate current session" to "new
  independent session,"** each rewritten to assert the new, arguably more
  meaningful guarantee: `team-presence.spec.ts`'s "resets team connections
  when a new quiz session is selected" → "does not carry a stale team
  connection over into a newly created session";
  `block-questions-and-response-indicators.spec.ts`'s equivalent for answered
  team ids; `question-lock-countdown.spec.ts`'s "clears the lock when a new
  quiz is selected" now checks the *new* session's lock (trivially null by
  construction) rather than re-checking the old session's already-cleared
  lock. `persistence-and-quiz-selection.spec.ts` was the most heavily
  rewritten file — every `selectQuiz(2)` call became `const created = await
  service.createSession(2)`, with later assertions/actions keyed off
  `created.joinCode` instead of implicit current-session state.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Every session-scoped method requires a `joinCode` and resolves independent state per session | `core-snapshot.spec.ts`, all migrated spec files | unit | PASS |
| 2 | Using the service before `onModuleInit` resolves throws regardless of which joinCode is passed | `core-snapshot.spec.ts` | unit | PASS |
| 3 | `createSession(quizId)` is rejected unless the default session is in lobby/ended | `persistence-and-quiz-selection.spec.ts`, `quiz-selection.spec.ts` (gateway) | unit | PASS |
| 4 | `createSession` allocates a new session (own joinCode, fresh lobby progress, empty leaderboard/teams/answered-ids/connections) without touching the previous session | `persistence-and-quiz-selection.spec.ts`, `team-presence.spec.ts`, `block-questions-and-response-indicators.spec.ts` | unit | PASS |
| 5 | `createSession` becomes the new default joinCode | `persistence-and-quiz-selection.spec.ts` | unit | PASS |
| 6 | Progress persists to the repository under the correct session's `gameSessionId` after `createSession` | `persistence-and-quiz-selection.spec.ts` | unit | PASS |
| 7 | Full state-machine transition suite (rules → round_intro → question_open → locking → break → reveal → ended) still holds per-session | `state-transitions.spec.ts`, `block-questions-and-response-indicators.spec.ts` | unit | PASS |
| 8 | Question-lock countdown arm/clear/rehydrate behavior holds per-session | `question-lock-countdown.spec.ts` | unit | PASS |
| 9 | Leaderboard toggle/reveal-count behavior holds per-session | `leaderboard.spec.ts` | unit | PASS |
| 10 | Team connection presence (connect/clear/kick) holds per-session | `team-presence.spec.ts` | unit | PASS |
| 11 | Admin-only question context (correct answer + round position) resolves per-session | `admin-question-context.spec.ts` | unit | PASS |
| 12 | Every existing gateway-level socket-event test (join, submit, grade, award bonus, kick, list answers, connection/reconnect, select quiz) still passes unmodified, proving the gateway's public behavior didn't change in this phase | `admin-actions`, `connection`, `grading`, `join-players`, `quiz-selection`, `socket-event-logging`, `submit-answer`, `team-connection-presence`, `award-bonus`, `question-lock-auto-advance` (all `.spec.ts`) | unit | PASS |
| 13 | `QuizController`/`ImportService` compile and behave correctly against the new `GameStateService` API | `quiz.controller.spec.ts`, `import.service.spec.ts`, `import.controller.spec.ts` | unit | PASS |

## Coverage and known gaps

Full backend suite: 304/304 tests passing across 40 suites (`pnpm --filter
backend test`). `tsc --noEmit` and ESLint (`--fix`, 8 pure-formatting diffs
resolved) both clean. `nest build` and a workspace-wide
`pnpm --filter backend build` (which also rebuilds the frontend) both green.

**Deliberately out of scope for Phase 2** (per the plan, deferred to later
phases): `GameGateway` actually scoping Socket.IO rooms per joinCode instead
of the three bare global rooms, rejecting handshakes with an unknown `code`,
and per-session `questionLockTimer` instances (Phase 3); `POST /sessions` /
`GET /sessions` admin REST endpoints and real multi-session creation policy
(Phase 4); frontend `?code=` wiring (Phase 5); a concurrent-session
cross-talk test proving session A's admin room never receives session B's
broadcasts (Phase 6 — meaningless before Phase 3 gives rooms per-session
scoping to test).

## Merge evidence

Not yet committed — evidence report written prior to the commit step per the
project's TDD workflow; see the accompanying commit for the RED (prior
session) and GREEN (this session) history.
