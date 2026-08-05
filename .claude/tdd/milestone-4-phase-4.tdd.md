# TDD Evidence Report: Milestone 4, Phase 4 — Session lifecycle admin surface

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 4 of 6 ("Session lifecycle admin
surface"). Scope per the plan: `POST /sessions` (create: pick a quiz → get a
joinCode) and `GET /sessions` (list currently-running sessions,
admin-guarded, mirroring the `import.controller.ts` admin-REST precedent) so
an admin can start a new game or attach to one already running; decide and
implement an eviction policy for ended/idle session state in the in-memory
map.

This phase also resolves two of the plan's open questions:

1. **Session creation surface** — REST, per the plan's own Phase 4 line (not
   revisited as a live decision; the plan already named `POST /sessions`).
2. **Eviction policy** — explicit admin action (`DELETE /sessions/:joinCode`,
   ended-sessions-only) rather than an idle-timeout sweep. Chosen for
   determinism and testability: no background timer, no wall-clock-based
   test flakiness, and it matches the existing `ImportBlockedError`/
   `ImportLockedError` pattern of a domain-specific error class mapped to an
   HTTP status in the controller. An idle-timeout sweep remains a possible
   future addition but is out of scope here (YAGNI — nothing in the plan or
   `CLAUDE.md`'s pub-quiz-scale framing demands it yet).

Question 3 (admin scope) needed no new decision: `SessionsController` follows
the exact `SessionGuard, RolesGuard` pattern already used by `QuizController`
and `ImportController` with no `@Roles(...)` restriction, so any
authenticated admin or moderator can see and act on every running session —
consistent with `CLAUDE.md`'s existing role model (global roles, not
per-session scoped).

## User journeys

1. As the quiz master, I want to start a second concurrent game (a second
   room, or a rematch) without disturbing whatever game is already running,
   so `POST /sessions` must succeed regardless of another session's status —
   the old single-session-era "only from lobby/ended" guard no longer makes
   sense once there's a real way to reach more than one session.
2. As the quiz master, I want to see every game currently running in the
   process (not just the one my browser happens to be attached to), with
   enough at-a-glance detail (which quiz, what status, how many teams) to
   pick the right one — `GET /sessions`.
3. As the backend, I want a bounded-lifetime in-memory map: once a session's
   quiz has genuinely ended, an explicit admin action should be able to free
   its memory, but a live game (or the one session every legacy single-game
   call site still implicitly depends on) must never be evicted out from
   under it.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 4 | `GameStateService.createSession` no longer blocks on the default session's status; added `listSessions()` and `closeSession()` (+ `SessionCloseBlockedError`); added `QuizService.findTitles()`; new `SessionsController` (`GET/POST /sessions`, `DELETE /sessions/:joinCode`), registered in `AppModule` | `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter backend build`, `pnpm build` (workspace-wide), `pnpm --filter @campus-pubquiz/types test` | PASS (328/328 backend tests, 43/43 suites, 73/73 shared-types tests, 0 lint errors/warnings, all workspace builds green) |

### RED

Three existing tests encoded the old single-session-era guard and needed to
fail against the new intent before any implementation change:

- `persistence-and-quiz-selection.spec.ts` — `'rejects creating a session
  while the default session has a quiz in progress'` asserted
  `service.createSession(2)` threw `/lobby/i` mid-game. Rewritten to assert
  the opposite: a new concurrent session is created successfully, and the
  original session's progress is left untouched.
- `quiz-selection.spec.ts` (gateway level) — `'surfaces a mid-game quiz
  selection as a WsException'` asserted `handleSelectQuiz` rejected mid-game.
  Rewritten to assert it now succeeds and creates/broadcasts into a new
  session.
- New spec file `session-lifecycle-admin.spec.ts` exercised
  `listSessions()`/`closeSession()`, which didn't exist yet —
  `TypeError: service.listSessions is not a function` /
  `service.closeSession is not a function` confirmed genuine RED.

New controller-level spec (`sessions.controller.spec.ts`) and service-level
additions (`quiz.service.spec.ts`) were written against not-yet-created
methods/files (`SessionsController`, `QuizService.findTitles`), which is this
repo's usual "write the test against the intended interface first" TDD
pattern rather than a literal failing-run — `SessionsController` did not
exist yet, so its spec could not run at all before the controller was
written.

### GREEN

Implemented, in order:

1. **`game-state.service.ts`**:
   - Removed `createSession`'s "must be in lobby/ended" guard entirely — it
     used to gate on the *default* session's status, which stopped making
     sense once a genuine multi-session creation surface exists. Updated the
     method's doc comment accordingly.
   - Added `SessionCloseBlockedError` (exported), mirroring
     `ImportBlockedError`/`ImportLockedError`'s pattern of a named `Error`
     subclass a controller can `instanceof`-check and map to an HTTP status.
   - Added `listSessions(): Omit<ActiveSessionSummary, 'quizTitle'>[]` —
     projects every entry in the `sessions` map to `{ joinCode, quizId,
     status, teamCount }`. Deliberately omits `quizTitle`: `GameStateService`
     only knows `quizId`, not quiz metadata, so the title is filled in by
     whoever composes this with `QuizService` (mirrors how `QuizController`
     already composes `QuizService` + `GameStateService` for `activeQuizId`).
   - Added `closeSession(joinCode): void` — throws `SessionCloseBlockedError`
     if the session's status isn't `'ended'`, or if `joinCode` is the current
     `defaultJoinCode` (legacy single-session call sites still resolve
     through `getDefaultJoinCode()` until Phase 5 removes that reliance);
     otherwise deletes the map entry.
2. **`quiz.service.ts`** — added `findTitles(quizIds: number[]):
   Promise<Map<number, string>>`, a batched `id: { $in: quizIds }` lookup
   against `QuizRepository`; returns an empty map without querying for an
   empty input.
3. **New `session/sessions.controller.ts`** — `SessionsController`, guarded
   by `SessionGuard, RolesGuard` (no `@Roles`, matching `QuizController`/
   `ImportController`):
   - `GET /sessions` — `listSessions()` + `findTitles()`, joined by `quizId`,
     falling back to `'Unknown quiz'` for a lookup miss.
   - `POST /sessions` — validates `quizId` is a present integer
     (`BadRequestException` otherwise, mirroring `requireCsvText` in
     `import.controller.ts`), calls `createSession`, attaches the title.
   - `DELETE /sessions/:joinCode` — `NotFoundException` for an unknown
     joinCode (checked via `hasSession` before calling `closeSession`, so the
     404 case is distinguished from the 409 "blocked" case);
     `SessionCloseBlockedError` → `ConflictException`; anything else bubbles
     up unchanged (same shape as `ImportController.confirm`'s catch block).
4. **`app.module.ts`** — registered `SessionsController` in `controllers`.

Full run after implementation:

```
Test Suites: 43 passed, 43 total
Tests:       328 passed, 328 total
```

`eslint --fix` cleared prettier-only import-wrapping diffs (multi-line named
imports from `game-state.service.ts`/`@campus-pubquiz/types`); zero
errors/warnings after. `tsc --noEmit`, `nest build`, and a workspace-wide
`pnpm build` (which also rebuilds `shared/types` and the frontend) all clean.
`shared/types`' own suite (73 tests) was unaffected — this phase used only
the `CreateSessionPayload`/`ActiveSessionSummary` contracts Phase 1 already
added, no new shared-types changes.

### Refactor

None needed. `listSessions()`'s return type reuses
`Omit<ActiveSessionSummary, 'quizTitle'>` rather than a hand-duplicated local
interface, keeping the REST contract and the service's return shape
mechanically in sync.

## Design decisions worth recording

- **`createSession` no longer checks any session's status before creating a
  new one.** The old guard read `this.getSession(this.requireDefaultJoinCode())`
  and threw if that session wasn't `lobby`/`ended` — a check against an
  *unrelated* session's progress, which only existed because there was no
  other way to reach a session other than the implicit default one before
  Phase 3/4. `applyAction(joinCode, ...)` itself never depended on this
  guard, so removing it doesn't change any single-session behavior; it only
  unblocks concurrent creation.
- **`createSession` still reassigns `defaultJoinCode` to the newly created
  session, unchanged from Phase 2.** This means the *most recently created*
  session — whether via `POST /sessions` or the legacy `SELECT_QUIZ` socket
  action — becomes the one every not-yet-`?code=`-aware call site
  (`QuizController.list()`'s `activeQuizId`, a codeless socket handshake)
  resolves to. This is scaffolding, not a new design: Phase 5's `?code=`
  wiring is what makes `defaultJoinCode` irrelevant, and until then this
  matches today's single-admin mental model ("the quiz I just picked is the
  one I'm looking at").
- **`closeSession` refuses to evict the default session, even once
  `ended`.** Without this guard, closing the only/last session (or the one
  every legacy call site implicitly depends on) would make
  `getDefaultJoinCode()`-reliant code throw "Unknown game session" on its
  next call. This restriction is explicitly temporary — noted in the method's
  doc comment as lifting once Phase 5 removes single-session reliance on
  `defaultJoinCode`.
- **No idle-timeout sweep.** Considered and rejected for this phase: a
  background `setInterval` sweeping `ended` sessions after N minutes adds a
  process-lifetime timer to reason about (start/stop with the module,
  interacts with `onModuleDestroy`) and wall-clock-dependent tests, for a
  problem explicit admin eviction already solves deterministically at
  pub-quiz scale (`CLAUDE.md`: "dozens of teams... intentional and
  correct"). Nothing currently blocks adding one later if a long-running
  deployment accumulates enough abandoned `ended` sessions to matter.
- **`GameGateway`'s per-session `questionLockTimers` map needs no changes
  for `closeSession`.** Confirmed by tracing `rearmQuestionLockTimer`: every
  `applyAction` call already clears a session's timer entry once its status
  leaves `'locking'` (`getQuestionLockAt` returns `null` for any other
  status), so by the time a session reaches `'ended'` — the only status
  `closeSession` accepts — it can never have a live timer left in the
  gateway's map.
- **`QuizService.findTitles` lives on `QuizService`, not baked into
  `SeededGame`/`GameStateService`.** Considered adding a `quizTitle` field to
  `SeededGame` (populated once at load time, avoiding a second query per
  `GET /sessions` call), but that would have required updating six existing
  `SeededGame` object literals across test fixtures for a field only the new
  admin-REST surface needs. Keeping quiz metadata on the `Quiz`/`QuizService`
  side and composing it at the REST boundary (exactly how `QuizController`
  already composes `QuizService.list()` + `GameStateService.getActiveQuizId()`)
  is both less churn and the established pattern in this codebase.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `createSession` succeeds even while the default session has a quiz in progress, leaving that session's own progress untouched | `persistence-and-quiz-selection.spec.ts` | unit | PASS |
| 2 | `listSessions()` reports every session's `joinCode`/`quizId`/`status`/`teamCount`, reflecting each session's own state independently | `session-lifecycle-admin.spec.ts` | unit | PASS |
| 3 | `closeSession()` rejects a non-`ended` session, rejects the default session even once `ended`, and evicts a non-default `ended` session (subsequent `listSessions()`/`getSnapshot()` no longer see it) | `session-lifecycle-admin.spec.ts` | unit | PASS |
| 4 | `QuizService.findTitles()` maps requested ids to titles, omits ids that don't exist, and short-circuits an empty input without querying | `quiz.service.spec.ts` (Postgres/Testcontainers integration) | integration | PASS |
| 5 | `SessionsController` is guarded by `SessionGuard` + `RolesGuard`; `GET /sessions` attaches titles (with an `'Unknown quiz'` fallback); `POST /sessions` validates `quizId` and returns the new session's summary; `DELETE /sessions/:joinCode` 404s on an unknown code, 409s on `SessionCloseBlockedError`, and lets other errors bubble up unchanged | `sessions.controller.spec.ts` | unit | PASS |
| 6 | A mid-game `SELECT_QUIZ` socket action now succeeds (creating a new concurrent session) instead of throwing `WsException` | `quiz-selection.spec.ts` | unit | PASS |
| 7 | Every pre-existing `GameStateService`/`GameGateway` behavior (state transitions, room scoping, grading, presence, etc.) is unaffected by this phase | full `src/game/__tests__/*.spec.ts` suite | unit | PASS |

## Coverage and known gaps

Full backend suite: 328/328 tests passing across 43 suites (`pnpm --filter
backend test`, up from 310/41 in Phase 3 — one new `GameStateService` spec
file (6 tests), one new controller spec file (9 tests), 3 new
`QuizService.findTitles` tests). `tsc --noEmit` and ESLint (`--fix`, then
zero errors/warnings) both clean. `nest build`, `pnpm --filter backend
build`, and a workspace-wide `pnpm build` (which also rebuilds
`shared/types` and the frontend) all green. `shared/types` suite: 73/73
unaffected.

**Deliberately out of scope for Phase 4** (per the plan, deferred to later
phases): frontend `?code=` wiring across `/display`, `/admin`, `/play`, and
an actual admin session-picker UI that calls `GET`/`POST`/`DELETE
/sessions` (Phase 5); removing `defaultJoinCode`/legacy codeless-handshake
reliance now that a real session-lifecycle surface exists (Phase 5, per the
`closeSession` default-session restriction above); a comprehensive
cross-talk verification sweep across the full socket event surface with two
simultaneously-progressing sessions, real rosters, answers, and grading
(Phase 6, per the Phase 3 report's own note — unchanged by this phase); an
idle-timeout eviction path (explicitly rejected for now, see Design
decisions above).

## Merge evidence

Not yet committed — evidence report written prior to the commit step per the
project's TDD workflow; see the accompanying commit for this phase's full
RED→GREEN history.
