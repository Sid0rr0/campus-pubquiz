# TDD Evidence Report: Milestone 4, Phase 3 — `GameGateway` room scoping

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 3 of 6 ("`GameGateway` room
scoping"). Scope per the plan: the handshake query gains `code` alongside
`role`; reject the connection if `code` doesn't resolve to a known session;
clients join `${role}:${code}` instead of bare `role`; `broadcastState`
targets that session's three rooms; `questionLockTimer` becomes
`Map<joinCode, NodeJS.Timeout>` with `onModuleDestroy` clearing all of them;
`client.data` stores `joinCode` at connect time so `handleDisconnect` can
update the right session's roster. Phase 2 already made `GameStateService`
itself hold N independent sessions in a `Map`; this phase is purely about the
real-time transport layer catching up to that.

## User journeys

1. As a backend developer implementing Phase 4/5 (session lifecycle + `?code=`
   frontend wiring), I want the gateway to already reject an unknown
   `?code=` handshake and route every socket into session-scoped rooms, so
   the frontend only has to pass the code it already knows — the gateway does
   the isolation.
2. As today's single quiz-night operator, I want the existing single-session
   admin/display/play flow (no `?code=` yet) to keep working exactly as
   before, resolving to whichever session is currently the default.
3. As a backend developer, I want two sessions running in the same process to
   be provably isolated at the transport layer: an admin action in session A
   must never reach a client connected to session B, and a disconnecting
   socket must only affect its own session's connection roster.
4. As an operator restarting the backend process, I want every session's
   question-lock timer cleaned up on shutdown, not just one — leftover timers
   across N sessions must not fire against a process that's going down.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 3 | `GameGateway` handshake accepts an optional `code`, validated against `GameStateService.hasSession()`; every room join/broadcast uses `sessionRoom(joinCode, role)` instead of the bare `SOCKET_ROOMS` constants; `client.data.joinCode` fixed at connect time backs every subsequent handler via a new `resolveJoinCode()` helper; `questionLockTimer` is now `Map<joinCode, NodeJS.Timeout>`; `SELECT_QUIZ` migrates the requesting admin's own socket into the newly-created session's room | `pnpm --filter backend test`, `pnpm --filter backend lint`, `pnpm --filter backend build`, `pnpm build` (workspace-wide) | PASS (310/310 tests, 41/41 suites, 0 lint errors/warnings, all four workspace builds green) |

### RED

Added one new method to `GameStateService` (`hasSession(joinCode): boolean`)
and a new spec file, `session-room-scoping.spec.ts`, exercising behavior that
didn't exist on the untouched gateway:

- Connecting with an explicit `?code=` and getting joined to that session's
  room, not a bare global one.
- Connecting with an unknown `?code=` being rejected outright.
- Two independently-created sessions (`ABCDEF` via `onModuleInit`'s seed,
  `GHIJKL` via `SELECT_QUIZ`/`createSession`) receiving admin-action
  broadcasts only in their own rooms — the core cross-talk guarantee.
- A disconnecting socket clearing the connection roster of *its own* session
  (via `client.data.joinCode`), not whatever session happens to be the
  current default.
- `onModuleDestroy` clearing every session's armed lock timer, not just one.

Running this file (and the existing suite, whose room-name assertions were
updated to the same `sessionRoom(...)` expectation ahead of the gateway
change) against the untouched gateway failed genuinely — `client.join` was
still called with the bare `SOCKET_ROOMS.DISPLAY`/`ADMIN`/`PLAYERS` strings,
`GameStateService.hasSession` didn't exist, and `createMockSocket` had no way
to supply a `code` or a `leave` mock:

```
● GameGateway — session room scoping › joins a connecting client to its session-scoped room when no code is given...
● GameGateway — session room scoping › rejects a connection whose code does not resolve to a known session
● GameGateway — session room scoping › keeps two sessions fully isolated...
● GameGateway — connection › joins a connecting display client to the display room...
  (and 15 more pre-existing room-name assertions across admin-actions, award-bonus,
   grading, quiz-selection, question-lock-auto-advance, join-players,
   team-connection-presence, submit-answer)

TypeError: this.gameState.hasSession is not a function
```

This session started from scratch (no prior-session RED commit) — Phase 2
was already fully committed and green, so this phase's RED state was created
fresh in this session and confirmed failing before any gateway edit.

### GREEN

Implemented, in order:

1. **`game-state.service.ts`** — added `hasSession(joinCode): boolean`
   (`this.sessions.has(joinCode)`), purely additive; lets the gateway
   validate a handshake's `?code=` before trusting it.
2. **`test-utils.ts`** — `createMockSocket` gained an optional 4th `code`
   param (merged into `handshake.query` alongside `role`) and a `leave` mock
   (`rooms.delete`), mirroring the existing `join`/`rooms` mock.
3. **`game.gateway.ts`**:
   - `questionLockTimer: NodeJS.Timeout | null` → `questionLockTimers: Map<string, NodeJS.Timeout>`; `onModuleDestroy` iterates and clears every entry.
   - `handleConnection` reads `client.handshake.query.code`. No code → resolves `getDefaultJoinCode()` (today's single-session UX, unchanged). A code that fails `hasSession()` → same rejection path as an unrecognized role (disconnect + warn + `exception` emit for admin-style feedback). A valid code is used as-is. The resolved `joinCode` is stamped onto `client.data` *before* joining, and the room joined is `sessionRoom(joinCode, role)` instead of bare `role`.
   - `handleDisconnect` reads `client.data.joinCode` (not `getDefaultJoinCode()`) so a socket connected to a non-default session frees the right session's roster; returns early if the socket never got a joinCode (e.g. it was rejected before finishing connect).
   - New private `resolveJoinCode(client)` — every other handler's single source of truth for "which session is this socket in," throwing `WsException` if a handler somehow runs on a socket that never completed `handleConnection`.
   - Every admin/player room-membership check (`client.rooms.has(...)`) now checks the session-scoped room name, not the bare one — this is what actually enforces "only an admin/player *of this session*" once rooms are per-session.
   - `broadcastState(joinCode, snapshot)` and `rearmQuestionLockTimer(joinCode)` both gained a leading `joinCode` param; the per-session timer `Map` replaces the single nullable field throughout `handleAdminAction`, `handleQuestionLockTimerExpired`, and `rearmQuestionLockTimer`.
   - `handleSelectQuiz` — since `createSession` (Phase 2) always mints a **new** joinCode, the calling admin's own socket is explicitly migrated: `client.leave(oldRoom)` + `client.join(newRoom)` + `client.data.joinCode` reassignment, before broadcasting into the new session's rooms. Documented as a deliberate, narrow fix (only the requesting socket moves — see Design decisions below).
4. **Sixteen room-name assertions across eight pre-existing spec files**
   (`admin-actions`, `connection`, `award-bonus`, `grading`, `quiz-selection`,
   `question-lock-auto-advance`, `join-players`, `team-connection-presence`,
   `submit-answer`) updated from bare `SOCKET_ROOMS.X` to
   `sessionRoom('<fixture joinCode>', SOCKET_ROOMS.X)` — `quiz-selection.spec.ts`
   specifically asserts against the **new** session's code (`GHIJKL`), since
   Phase 3's `handleSelectQuiz` broadcasts into the migrated session, not the
   one the admin was originally in.

Full run after implementation:

```
Test Suites: 41 passed, 41 total
Tests:       310 passed, 310 total
```

`eslint --fix` cleared prettier-only import-wrapping diffs from adding
`sessionRoom` to import lists; one real warning
(`@typescript-eslint/no-floating-promises` on `client.leave(...)`, whose
socket.io type signature is `Promise<void> | void`) was fixed by awaiting it,
matching the existing `await client.join(...)` right below it. Zero
errors/warnings after. `tsc --noEmit` and `nest build` both clean; a
workspace-wide `pnpm build` also built `shared/types` and the frontend
successfully (no cross-workspace breakage).

### Refactor

None needed beyond what's described above. `resolveJoinCode` was pulled out
as its own private helper rather than inlined at each call site once it
became clear nearly every non-connection handler needed the identical
"read-or-throw" logic.

## Design decisions worth recording

- **`code` is optional on the handshake, exactly as the Phase 1 shared-types
  contract (`GameSocketHandshakeQuery`) already declared.** No code falls
  back to `getDefaultJoinCode()` — today's single-session admin/display/play
  pages, which don't know about `?code=` yet, connect exactly as before.
  Phase 5 is where the frontend starts sending a real code.
- **`SELECT_QUIZ` migrates only the requesting admin's own socket into the
  newly-created session, not every socket already in the old session's
  rooms.** `createSession` (Phase 2) always mints a brand-new joinCode, so
  without some migration the requesting admin would be talking into rooms no
  one (including itself) is in anymore. Migrating *only* the caller is a
  deliberate, narrow fix scoped to what today's single-admin-driven flow
  needs to keep working; a display or player socket that connected to the
  old session *before* this fired is not moved. Real multi-session creation
  UX — an explicit admin picker/creation surface, distinct from this legacy
  socket action — is Phase 4 (`POST /sessions`) and Phase 5 (frontend
  `?code=` navigation), where a session's other clients are expected to
  reconnect with the new code rather than be silently migrated mid-flight.
  This is the plan's Phase 4 "session creation surface" open question
  surfacing early, not a gap introduced by this phase.
- **Old sessions are never evicted, so an explicit `?code=` can always
  reconnect to a session that's no longer the default.** This is what makes
  the cross-talk test in `session-room-scoping.spec.ts` possible without
  Phase 4's eviction policy existing yet: session A (`ABCDEF`) stays fully
  addressable and independently progressable via its own joinCode even after
  `SELECT_QUIZ` makes session B (`GHIJKL`) the new default. Confirms the
  plan's Phase 2 note that `createSession`'s "gates on the *default*
  session's status" rule is interim — `applyAction(joinCode, ...)` itself
  never checked "is this the default," so two sessions genuinely progress
  concurrently once each has its own connected socket(s).
- **`resolveJoinCode` throws rather than falling back to
  `getDefaultJoinCode()`.** A handler running against a socket with no
  `client.data.joinCode` means `handleConnection` never completed for it
  (e.g. it was rejected) — silently falling back to "whatever session is
  currently default" would let a rejected/foreign socket act against the
  wrong session. This path is defensive and not currently exercised by a
  passing-case test (every test connects through `handleConnection` first),
  matching how `GameStateService`'s equivalent "used before initialization"
  guard was also introduced defensively in Phase 2 ahead of having a test
  that needs it.
- **`onModuleDestroy` clears every timer in the `Map`, unconditionally.**
  No attempt is made to distinguish "this session's timer should keep
  running" — module destroy means the whole process is going down, so every
  session's countdown is moot regardless of which one is default.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `GameStateService.hasSession(joinCode)` reports whether a session exists | `session-room-scoping.spec.ts` (exercised indirectly via connection rejection) | unit | PASS |
| 2 | Connecting with no `code` resolves to the current default session's room | `session-room-scoping.spec.ts`, `connection.spec.ts` | unit | PASS |
| 3 | Connecting with an explicit, known `code` joins that session's room and receives that session's snapshot | `session-room-scoping.spec.ts` | unit | PASS |
| 4 | Connecting with an unknown `code` is rejected (no join, socket disconnected) | `session-room-scoping.spec.ts` | unit | PASS |
| 5 | An admin action in one session broadcasts only to that session's three rooms, never the other's | `session-room-scoping.spec.ts` | unit | PASS |
| 6 | A disconnecting socket clears its own session's connection roster, not the current default's | `session-room-scoping.spec.ts` | unit | PASS |
| 7 | `onModuleDestroy` clears every session's armed question-lock timer | `session-room-scoping.spec.ts` | unit | PASS |
| 8 | Every pre-existing gateway-level behavior (admin actions, join, submit, grade, list answers, kick, award bonus, quiz selection, question-lock auto-advance, socket event logging) still holds, now asserting session-scoped room names | `admin-actions`, `connection`, `award-bonus`, `grading`, `quiz-selection`, `question-lock-auto-advance`, `join-players`, `team-connection-presence`, `submit-answer`, `socket-event-logging` (all `.spec.ts`) | unit | PASS |
| 9 | `GameStateService`-level behavior (state transitions, block questions, leaderboard, team presence, persistence/quiz-selection, admin question context) is untouched by this phase — no test changes needed since these test the service directly, not the gateway | `state-transitions`, `block-questions-and-response-indicators`, `leaderboard`, `team-presence`, `persistence-and-quiz-selection`, `admin-question-context`, `core-snapshot`, `question-lock-countdown` (all `.spec.ts`) | unit | PASS |

## Coverage and known gaps

Full backend suite: 310/310 tests passing across 41 suites (`pnpm --filter
backend test`, up from 304/40 in Phase 2 — one new spec file with 6 tests).
`tsc --noEmit` and ESLint (`--fix`, then zero errors/warnings) both clean.
`nest build`, `pnpm --filter backend build`, and a workspace-wide `pnpm
build` (which also rebuilds `shared/types` and the frontend) all green.

**Deliberately out of scope for Phase 3** (per the plan, deferred to later
phases): `POST /sessions` / `GET /sessions` admin REST endpoints and a real
multi-session creation policy that doesn't gate on the default session's
status (Phase 4); frontend `?code=` wiring across `/display`, `/admin`,
`/play`, and an admin session picker (Phase 5); a *comprehensive*
cross-talk verification sweep covering every socket event type across two
simultaneously-progressing sessions with real team rosters, answers, and
grading — this phase's `session-room-scoping.spec.ts` proves the room-scoping
mechanism itself works (admin actions, disconnects, timers), but the full
"zero cross-talk across the entire event surface" proof is Phase 6's job now
that Phase 3 gives it something to test against.

## Merge evidence

Not yet committed — evidence report written prior to the commit step per the
project's TDD workflow; see the accompanying commit for this phase's full
RED→GREEN history.
