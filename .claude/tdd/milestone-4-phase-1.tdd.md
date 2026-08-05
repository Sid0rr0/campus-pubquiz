# TDD Evidence Report: Milestone 4, Phase 1 — Shared Types for Concurrent Sessions

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 1 of 6 ("Shared types"). Scope per
the plan: add `code` to the socket handshake contract, a `sessionRoom(code,
role)` helper so the `${role}:${code}` room-naming convention lives in one
place, and `CreateSessionPayload`/`ActiveSessionSummary` types for the
upcoming session-lifecycle REST endpoints (Phase 4). No runtime behavior
changes in this phase — `GameStateService`, `GameGateway`, and the frontend
handshake still pass a bare `role`; that wiring is Phase 2/3/5.

## User journeys

1. As a backend developer implementing Phase 3 (gateway room scoping), I want
   one shared `sessionRoom(code, role)` function, so the `${role}:${code}`
   string format isn't hand-rolled at each call site and can't drift.
2. As a backend/frontend developer, I want the socket handshake query typed
   with an optional `code`, so today's single-session handshake (`{ role }`,
   no code) keeps compiling unchanged while multi-session clients can add a
   `code` once Phase 5 wires it through.
3. As a backend/frontend developer implementing Phase 4's `POST /sessions` /
   `GET /sessions`, I want `CreateSessionPayload` and `ActiveSessionSummary`
   defined now, so both sides agree on the contract before either endpoint or
   its admin UI exists.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 1 | Added `SocketRoomName`, `GameSocketHandshakeQuery` (`code` optional), `sessionRoom(code, role)`, `CreateSessionPayload`, `ActiveSessionSummary` to `shared/types/src/socket-events.ts` | `cd shared/types && pnpm test` | PASS (73/73, includes 6 new) |

### RED

`sessionRoom` did not exist yet, so calling it in the new tests threw at
runtime (`(0 , sessionRoom) is not a function`) — 2 failing tests, genuine RED
caused by the missing implementation:

```
❯ src/socket-events.test.ts (12 tests | 2 failed)
   × sessionRoom > joins role and code with a colon so each session gets its own room per role
     → (0 , sessionRoom) is not a function
   × sessionRoom > produces distinct room names for different join codes with the same role
     → (0 , sessionRoom) is not a function
 Test Files  1 failed | 2 passed (3)
      Tests  2 failed | 71 passed (73)
```

Note: this project's `tsconfig.json` excludes `**/*.test.ts` from `tsc`, and
Vitest's esbuild transform erases `import type` specifiers before running —
so the four new *type-only* additions (`GameSocketHandshakeQuery`,
`CreateSessionPayload`, `ActiveSessionSummary`, plus `SocketRoomName` used
internally) don't produce a runtime RED signal the way `sessionRoom` does.
To confirm those type usages were structurally sound (not just silently
erased), the test file was independently type-checked outside the project's
excluded-tests config:

```
npx tsc --noEmit --strict --esModuleInterop --skipLibCheck \
  --moduleResolution nodenext --module nodenext --target ES2023 \
  src/socket-events.test.ts
```

This reported 6 pre-existing errors in unrelated, already-passing tests
(missing `furthestOpenIndex`/`roundTitle`/position fields added by earlier
milestones, never caught because tests are excluded from `tsc`) — none in
the new `sessionRoom`/`GameSocketHandshakeQuery`/`CreateSessionPayload`/
`ActiveSessionSummary` assertions. That pre-existing gap is out of scope for
this phase and untouched.

### GREEN

```
 ✓ src/import.test.ts (5 tests) 2ms
 ✓ src/socket-events.test.ts (12 tests) 3ms
 ✓ src/game-state.test.ts (56 tests) 6ms

 Test Files  3 passed (3)
      Tests  73 passed (73)
```

`pnpm lint` (`tsc --noEmit`) and `pnpm build` both pass with no errors.

### Refactor

None needed — the added code is four short type declarations plus a
one-line pure function; no duplication or unclear naming to clean up.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `sessionRoom(code, role)` returns `"${role}:${code}"` for each of the three room roles | `shared/types/src/socket-events.test.ts:sessionRoom` | unit | PASS |
| 2 | `sessionRoom` produces distinct room names for different join codes with the same role | `shared/types/src/socket-events.test.ts:sessionRoom` | unit | PASS |
| 3 | `GameSocketHandshakeQuery` accepts a bare `{ role }` with no `code` (today's single-session handshake keeps compiling) | `shared/types/src/socket-events.test.ts:GameSocketHandshakeQuery` | unit (type usage) | PASS |
| 4 | `GameSocketHandshakeQuery` accepts `{ role, code }` for multi-session connections | `shared/types/src/socket-events.test.ts:GameSocketHandshakeQuery` | unit (type usage) | PASS |
| 5 | `CreateSessionPayload` carries the `quizId` needed to start a new concurrent session | `shared/types/src/socket-events.test.ts:session lifecycle payloads` | unit (type usage) | PASS |
| 6 | `ActiveSessionSummary` describes one running session (joinCode, quiz, status, team count) for the admin session picker | `shared/types/src/socket-events.test.ts:session lifecycle payloads` | unit (type usage) | PASS |

## Coverage and known gaps

`pnpm test:coverage` in `shared/types`: `socket-events.ts` is 100%
statements/branches/functions/lines. Workspace-wide: 96.58% stmts / 99.06%
branch / 96% funcs / 96.58% lines — above the 80% floor. The only file below
threshold is `auth.ts` (0%, pre-existing, untouched by this phase and out of
scope).

**Known gap:** the type-level guarantees (#3–#6 above) are proven by
assigning literals to the exported types and asserting on the resulting
values — real but weaker than a dedicated type-check gate, since this
project's `tsc` lint intentionally excludes test files. This mirrors the
existing project convention (see e.g. `import.test.ts`), not a regression
introduced here.

**Deliberately out of scope for Phase 1** (per the plan, deferred to later
phases): `GameStateService` per-session state (Phase 2), `GameGateway` room
scoping actually using `sessionRoom`/`GameSocketHandshakeQuery` (Phase 3),
`POST /sessions` / `GET /sessions` REST endpoints actually returning
`ActiveSessionSummary` (Phase 4), and frontend `?code=` wiring (Phase 5).

## Merge evidence

Two checkpoint commits on `main`:

- `0d0aa3a` — `test(shared-types): add reproducer for milestone-4 phase 1 session types` (RED)
- `4f63c21` — `feat(shared-types): add session-lifecycle contract for milestone-4 phase 1` (GREEN)
