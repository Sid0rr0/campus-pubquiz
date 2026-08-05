# TDD Evidence Report: Milestone 4, Phase 6 — Verification

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 6 of 6 ("Verification"). Scope
per the plan: "New tests proving two concurrent sessions progress
independently (state, rosters, question-lock timers) with zero cross-talk
— a client in session A's admin room must never receive session B's
broadcasts. Full `pnpm test` / `pnpm lint` / `pnpm build` across
workspaces."

## Starting gap

Phases 1–5 built and wired the entire multi-session surface, and picked up
broadcast-routing coverage for two sessions along the way (Phase 3's
`session-room-scoping.spec.ts`: room targeting on connect, `SELECT_QUIZ`,
disconnect roster-clearing, and one hand-built fixture for cross-session
timer teardown on `onModuleDestroy`). What no existing suite proved end to
end: **two sessions run through actual gameplay concurrently** — state
machine advancing independently, team rosters, submitted answers, grading,
and the leaderboard, plus the question-lock countdown timer racing for two
sessions *at the same time* (not one bespoke fixture at a time) — with the
explicit claim that nothing from one leaks into the other.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 6 | Added `concurrent-sessions.spec.ts`: one `GameStateService`/`GameGateway` pair driving two independently-seeded sessions (`AAAAAA`/`BBBBBB`) through the full state machine, team join, answer submission, grading, and the question-lock countdown, with `teamService`/`answerService` fakes keyed by `gameSessionId` so cross-talk would show up as wrong data, not just a missed assertion. Then ran `pnpm test`, `pnpm lint`, `pnpm build` workspace-wide. | `pnpm --filter backend test`, `pnpm test` (workspace), `pnpm lint`, `pnpm build` | PASS (331/331 backend tests across 44 suites — up from 328/44 before this phase's 1 new file/3 tests; 256/256 frontend; 73/73 shared-types; 0 lint errors/warnings; all four workspace builds green) |

### RED → GREEN

The three new tests were written against the already-built Phase 2/3
implementation (`GameStateService`'s `Map<joinCode, SessionState>`,
`GameGateway`'s per-session rooms/timers) — this phase adds regression
coverage for existing behavior rather than driving new production code, so
"RED" here means: written first, run once unmodified to confirm they
actually exercise the isolation path (not vacuously true), then confirmed
GREEN.

1. **State-machine independence** — `openSessionA()` advances session A
   (the default session from `onModuleInit`) to `question_open`; a second
   admin then calls `SELECT_QUIZ` to mint session B. Before B is touched,
   the test asserts A is still `question_open` and B starts fresh at
   `lobby` — proving `createSession` never overwrites another session's map
   entry. B is then independently advanced to `question_open`, and both
   sessions are asserted to hold distinct `currentQuestion.id` (501 vs 502)
   and distinct `gameSessionId` (301 vs 302) simultaneously, with the final
   broadcast checked against `server.to` to confirm it only targeted B's
   three rooms.
2. **Roster/answer/grading independence** — a fake `teamService`/
   `answerService` pair keyed by `gameSessionId` (not the shared canned
   fixture from `test-utils.ts`, which returns identical data regardless of
   which session calls it and so can't distinguish cross-talk from correct
   isolation) joins a different team into each session, submits a different
   answer into each, and grades only session A. Assertions confirm: each
   session's `teams`/`answeredTeamIds` contain only their own team, `submit`
   was called with each session's own `gameSessionId` in order
   (`toHaveBeenNthCalledWith`), and — the actual isolation claim — A's
   leaderboard is populated after grading while B's stays `[]`, proving
   `setLeaderboard(joinCode, ...)` never touches the other session's entry.
3. **Concurrent question-lock timers** — both sessions are advanced into
   `locking` (arming each session's entry in `GameGateway`'s
   `Map<joinCode, NodeJS.Timeout>`), confirmed armed via
   `getQuestionLockAt()` for both. B's countdown is then cancelled with a
   `PREVIOUS` action; the test asserts B's lock clears while A's stays
   armed. Advancing fake timers by the full 60s lock duration then asserts
   A auto-fired into `break_intro` while B — cancelled — stayed at
   `question_open`, and that the resulting broadcast (`server.to`) only
   reached A's rooms. This is the one assertion this phase adds that Phase
   3's single-fixture timer test structurally could not make: two armed
   timers coexisting and only one of a *pair* firing, rather than one
   fixture's timer firing or being cleared in isolation.

Full workspace run after adding the file:

```
apps/backend test: Test Suites: 44 passed, 44 total
apps/backend test: Tests:       331 passed, 331 total
apps/frontend test:  Test Files  40 passed (40)
apps/frontend test:       Tests  256 passed (256)
```

(shared/types: 73/73, run separately — `pnpm test` at the workspace root
does not include it as a script target, matching every prior phase's
report.)

### Refactor

None — this phase adds one new spec file; no production code changed.

## Design decisions worth recording

- **New fakes instead of reusing `test-utils.ts`'s shared
  `createFakeTeamService`/`createFakeAnswerService`.** Those fixtures
  return the same canned team/answer regardless of which `gameSessionId`
  they're called with — sufficient for every existing single-session
  test, but useless for proving isolation between two sessions, since a
  cross-talk bug (e.g. session B's grade landing on session A's
  leaderboard) would be invisible against identical canned data either
  way. This file's `createSessionAwareTeamService`/
  `createSessionAwareAnswerService` key their mock responses off the
  `gameSessionId` argument instead, so a routing bug produces a visibly
  wrong team/answer/leaderboard entry, not just a silently-passing
  assertion.
- **One shared `GameGateway`/`GameStateService` pair driving both
  sessions**, not two separate gateway instances. Two instances would
  trivially never cross-talk (they don't even share a `Map`) — the actual
  regression this phase guards against only exists when one process's one
  `questionLockTimers` map and one `sessions` map hold both sessions'
  state simultaneously, which is exactly how the real backend runs.
- **Fixtures are single-question, `breakAfter: true` rounds** for both
  sessions, so `question_open` is reachable in exactly two `ADVANCE`
  calls from `lobby` and `locking` arms on the very next `ADVANCE` — kept
  the three tests focused on cross-session isolation rather than
  restating the state-machine transition table already covered by
  `state-transitions.spec.ts` and `question-lock-auto-advance.spec.ts`.
- **No frontend or E2E addition this phase.** The plan's Phase 6 scope is
  backend cross-talk verification specifically (the frontend's own
  session-awareness was Phase 5's job, and Phase 5's report already noted
  "a comprehensive cross-talk verification sweep" as deferred here) — nothing
  in `/display`, `/admin`, or `/play` needed new tests to satisfy this
  phase's stated goal.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | Two sessions advance through `lobby → question_open` fully independently; creating/advancing one never changes the other's status, current question, or `gameSessionId`; broadcasts target only the acting session's rooms | `concurrent-sessions.spec.ts` | unit/integration | PASS |
| 2 | Team rosters, submitted answers, and graded leaderboards stay fully isolated between two concurrently-open sessions, even when both share one `teamService`/`answerService`/`GameStateService` instance | `concurrent-sessions.spec.ts` | unit/integration | PASS |
| 3 | Two sessions can each independently arm a question-lock timer; cancelling one session's countdown leaves the other's armed; when the surviving timer fires, only its own session transitions and broadcasts | `concurrent-sessions.spec.ts` | unit/integration | PASS |
| — | Every pre-existing single- and dual-session test (room scoping, admin actions, grading, submit-answer, question-lock auto-advance, session lifecycle admin surface, etc.) is unaffected | full backend/frontend/shared-types suites | unit | PASS |

## Coverage and known gaps

Backend: 331/331 tests across 44 suites (up from 328/44 — 1 new file, 3 new
tests). Frontend: 256/256 across 40 suites, unaffected (no frontend files
touched). Shared types: 73/73, unaffected. ESLint clean across
`apps/backend` and `apps/frontend` (0 errors/warnings; `eslint --fix` only
reformatted this phase's new file, no logic changes). `pnpm build`
green for `shared/types` (`tsc`), `apps/backend` (`nest build`), and
`apps/frontend` (`next build`, including its own `tsc --noEmit` pass).

**Known gaps, unchanged from earlier phases' reports (not this phase's
scope to close):** no real-socket/E2E test drives two actual Socket.IO
client connections through the gateway over the wire — all backend
coverage (this phase included) exercises `GameGateway`'s handlers directly
against mock `Socket`/`Server` objects, per the existing convention in
every file under `apps/backend/src/game/__tests__/`. No idle-timeout
session eviction sweep exists (explicitly rejected as a policy back in
Phase 4). The server's codeless-handshake fallback to `defaultJoinCode`
remains in place (Phase 5 noted removing it is a backend change out of its
own scope; this phase didn't touch it either, since it's orthogonal to
proving concurrent sessions don't cross-talk once a code *is* given).

## Merge evidence

Not yet committed — evidence report written prior to the commit step per
the project's TDD workflow; see the accompanying commit for this phase's
full RED→GREEN history.
