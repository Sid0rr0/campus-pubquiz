# TDD Evidence Report: Milestone 4, Phase 5 — Frontend wiring

## Source plan

`.claude/plans/milestone-4.plan.md` — Phase 5 of 6 ("Frontend wiring"). Scope
per the plan: thread `?code=` through `/display`, `/admin`, `/play`; give
admin a session picker/creation screen before landing on a specific
session's controls; make the socket-connecting hook(s) pass `code` into the
handshake query; make join-link/QR code generation include `?code=`.

## Starting gap

Phases 1–4 built the entire backend multi-session surface (per-session
`GameStateService` state, per-session Socket.IO rooms, `POST/GET/DELETE
/sessions`), but no frontend page actually used any of it: `useGameSocket`
never sent a `code` in its handshake query, so every connection resolved to
the server's single implicit "default" session regardless of what a user
typed or scanned. `/display` already read `?code=` from the URL but only
used it for the QR code's *display* value, not for routing its own
connection. `/admin` had no `?code=` awareness at all — one implicit game,
exactly as before Phase 2.

## User journeys

1. As the quiz master, I want to see every session currently running and
   either open one or start a new one, so `/admin` with no `?code=` shows a
   picker (`GET /sessions` + `POST /sessions`) instead of assuming there is
   only one game.
2. As a team on my phone, I want scanning the display's QR code (or typing
   the printed code) to connect me to *that* session specifically, not
   whichever session happens to be "the default" on the backend.
3. As the display screen operator, I want a URL with `?code=` that reliably
   shows the right game, so two simultaneous quiz nights don't cross-wire.

## Task report

| Phase | Summary | Validation command | Result |
|---|---|---|---|
| 5 | `useGameSocket` takes an optional `joinCode`, sent as `code` in the handshake query and reconnecting on change; `/display` and `/play` thread it through (with `/play` deferring the socket connection until a code is actually known); new `sessions-api.ts` REST client; new `SessionPickerPanel` (list running sessions, start a new one, close an ended one); `/admin` gates on `?code=` (picker vs. console) and syncs the URL when `SELECT_QUIZ` migrates the socket to a new session; sidebar "Open display"/"Switch session" links | `pnpm --filter frontend test`, `pnpm --filter frontend lint`, `pnpm build` (workspace-wide), `pnpm --filter backend test`, `pnpm --filter @campus-pubquiz/types test` | PASS (256/256 frontend tests, 40/40 suites, 0 lint errors/warnings; 328/328 backend tests unaffected; 73/73 shared-types tests unaffected; all workspace builds green) |

### RED → GREEN, by piece

1. **`useGameSocket`** — added two tests first (`includes the join code in
   the handshake query when provided`, `reconnects with a new handshake
   query when the join code changes`), confirmed they failed against the
   unmodified hook (no third parameter existed), then added the optional
   `joinCode` parameter, included it as `{ role, code: joinCode }` in the
   `io()` query when present, and added it to the connecting effect's
   dependency array so a changed code tears down and reopens the socket.
   Kept the parameter optional and the query shape `{ role }` when absent,
   so the one existing test pinning the exact handshake query
   (`connects with credentials...`) needed no change — backward compatible
   for every other caller.
2. **`/display`** — added `passes the ?code= query parameter to the socket
   handshake`, confirmed RED (hook was called as `useGameSocket('display')`
   with no third argument), then threaded `codeFromUrl` into the hook call
   and kept the existing `joinCode` display-value fallback
   (`codeFromUrl ?? snapshot?.joinCode`) unchanged.
3. **`/play`** — added three tests (`passes the ?code= query parameter to
   the socket handshake`, `does not connect the socket until a join code is
   known`, `connects the socket once a code is submitted through the join
   form`), confirmed RED, then reworked the page around a new
   `activeJoinCode` piece of state: the socket only connects once a code is
   known (URL, then storage, then the join form), and the previously
   direct `joinTeam(...)` calls inside the storage-read mount effect and
   `handleJoin` were replaced by a single effect keyed on
   `[teamName, activeJoinCode, joinTeam]`. This was a deliberate fix for a
   real race: calling `joinTeam` synchronously in the same effect/handler
   that *first* sets `activeJoinCode` from `null` would run before
   `useGameSocket`'s own connecting effect has had a chance to create the
   socket (`socketRef.current` still `null`), silently dropping the join
   — socket.io-client only buffers `emit()` calls once a `Socket` instance
   exists, not before. All 8 pre-existing `join-and-reconnect.test.tsx`
   tests (which mock the hook entirely and don't exercise this timing)
   stayed green throughout since they only assert `joinTeam` gets called
   with the right arguments eventually, not the ordering.
4. **`sessions-api.ts`** — net-new REST client; tests written first against
   the not-yet-existing module (`fetchSessions`/`createSession`/
   `closeSession`/`SessionApiError`), confirmed RED (module didn't exist),
   then implemented mirroring `import-api.ts`'s error-handling shape.
5. **`SessionPickerPanel`** — net-new component; 8 tests written first
   (empty state, session list with quiz/status/team-count, Open button,
   Close button gated on `status === 'ended'` + list refresh, quiz list for
   starting a new session, create-and-open flow, and error surfaces for
   both list-load and create failures), confirmed RED (component didn't
   exist), then implemented self-fetching on mount (mirrors
   `ImportPanel`'s self-managed-state convention) with `onOpenSession`
   as its only prop — navigation stays owned by the page, since only the
   page holds the router.
6. **`/admin` routing** — new `session-routing.test.tsx` (7 tests: picker
   shown with no `?code=`, socket not connected until a code exists, `Open
   new session` → `router.push('/admin?code=...')`, socket connects once a
   code is in the URL, URL syncs via `router.replace` when the snapshot's
   `joinCode` differs from the URL's — and does *not* sync when they
   already match, plus the sidebar links), confirmed RED (the page had no
   `useSearchParams`/`useRouter` calls at all), then wired `AdminPageContent`
   (wrapped in `Suspense`, matching `/display` and `/play`'s existing
   pattern): `sessionCode = searchParams.get('code')`; `useGameSocket`
   gated on `isAuthenticated && Boolean(sessionCode)`; renders
   `SessionPickerPanel` when `!sessionCode`; an effect calls
   `router.replace` when `snapshot.joinCode !== sessionCode`.
7. All 7 **pre-existing** admin test files (`connection`, `grading`,
   `keyboard-shortcuts`, `leaderboard`, `navigation`, `quiz-picker`,
   `status-and-teams`) needed a `next/navigation` mock added (matching the
   pattern `/display` and `/play`'s test suites already used), defaulting
   `searchParams` to `code=TESTCODE` so these console-focused suites keep
   exercising the console branch unchanged rather than the new picker.
   `connection.test.tsx`'s two assertions pinning the exact
   `useGameSocket('admin', true)` call were updated to include the third
   `'TESTCODE'` argument — the only pre-existing assertions in the whole
   frontend suite that pinned the hook's exact call signature.

Full run after implementation:

```
Test Files  40 passed (40)
     Tests  256 passed (256)
```

### Refactor

None needed beyond what's described above — the `/play` rewrite already
collapsed three previously-separate `joinTeam(...)` call sites' worth of
option-building logic into one effect.

## Design decisions worth recording

- **`QuizPickerPanel`'s existing in-console "Choose Quiz"/"Restart Quiz" flow
  was left untouched, not removed.** Per Phase 4, `SELECT_QUIZ` now always
  creates a brand-new session (never overwrites the current one) and
  migrates the requesting admin's own socket into it — this is exactly what
  the picker's "Restart"/"Select" actions already trigger, just via the
  legacy socket action instead of `POST /sessions`. Rather than forcing
  every quiz choice through the new REST picker screen, the console's
  existing picker keeps working as "start a fresh session with this quiz,
  right now, without leaving the console" — and the new `router.replace`
  effect keeps the URL's `?code=` following wherever `SELECT_QUIZ` actually
  lands. The `SessionPickerPanel`'s "Start a New Session" list is the same
  capability reached from outside any specific session, before one is
  picked.
- **`SessionPickerPanel` has no confirm-before-create step**, unlike
  `QuizPickerPanel`'s explicit "Start X? This replaces the current game
  session" dialog. Creating a session from the picker is additive — it can
  never destroy another running game's state (Phase 4 removed the old
  status guard specifically to make concurrent creation safe) — so the
  extra confirmation step that made sense for the old single-session
  "this replaces the current game" warning has no destructive action left
  to warn about here.
- **`/play`'s socket connection is now gated on knowing a join code at
  all**, a behavior change from before (where the hook always connected
  regardless, landing in the server's default session). This was necessary
  for correctness once "default session" stopped being a safe assumption
  with multiple sessions running, and it required moving every `joinTeam`
  call out of synchronous effect/handler bodies that also set the code for
  the first time, into a dedicated effect keyed on
  `[teamName, activeJoinCode, joinTeam]` — see RED/GREEN section above for
  the race this avoids. `teamCodeInput` is deliberately excluded from that
  effect's dependencies (read via a ref instead) so retyping it doesn't
  re-fire the join.
- **No idle/no-op eviction UI beyond the existing `DELETE
  /sessions/:joinCode`** — `SessionPickerPanel` exposes "Close" only for
  `status === 'ended'` sessions, mirroring `SessionCloseBlockedError`'s
  existing server-side restriction one-for-one; no new lifecycle policy was
  invented on the frontend.
- **Legacy codeless connections (no `?code=` at all) still work** for
  `/display` and `/play` — falling through to the server's
  `getDefaultJoinCode()` — since removing that fallback is explicitly
  Phase 5's *documented-as-deferred* concern in the Phase 4 report ("lifting
  once Phase 5 removes single-session reliance on `defaultJoinCode`"), and
  nothing in this phase's own scope required removing it: every
  first-party entry point (`SessionPickerPanel`'s Open button, the QR
  code's `?code=` link, the `router.replace` URL sync) now always supplies
  an explicit code, so the fallback only matters for a stale/manually-typed
  bare URL, which is reasonable to leave working rather than break.

## Test specification

| # | What is guaranteed | Test file | Type | Result |
|---|---|---|---|---|
| 1 | `useGameSocket` sends `{ role, code }` when a join code is given, and reconnects (disconnect + new `io()` call) when it changes | `use-game-socket.test.ts` | unit | PASS |
| 2 | `/display` passes its `?code=` query param straight through to the socket handshake | `display/__tests__/lobby.test.tsx` | unit | PASS |
| 3 | `/play`'s socket stays disconnected with no join code known, connects once the URL/join form supplies one, and reconnects if it changes | `play/__tests__/join-and-reconnect.test.tsx` | unit | PASS |
| 4 | `sessions-api.ts`'s `fetchSessions`/`createSession`/`closeSession` hit the right REST endpoints with credentials and surface `SessionApiError` on failure | `lib/sessions-api.test.ts` | unit | PASS |
| 5 | `SessionPickerPanel` lists sessions and quizzes, opens/creates/closes correctly, and surfaces load/create errors | `admin/__tests__/session-picker-panel.test.tsx` | unit | PASS |
| 6 | `/admin` shows the picker with no `?code=`, gates the socket on a known code, navigates on Open, and syncs the URL exactly when the snapshot's session differs (not when it matches) | `admin/__tests__/session-routing.test.tsx` | unit | PASS |
| 7 | Every pre-existing admin console behavior (grading, navigation, leaderboard, keyboard shortcuts, status/teams, the in-console quiz picker, auth/connection flow) is unaffected once a session code is present | full `app/admin/__tests__/*.test.tsx` suite | unit | PASS |

## Coverage and known gaps

Full frontend suite: 256/256 tests passing across 40 suites (up from 231/37
before this phase — 7 new tests on `useGameSocket`/`/display`/`/play`, plus
3 new test files: `sessions-api.test.ts` (6), `session-picker-panel.test.tsx`
(8), `session-routing.test.tsx` (7)). ESLint clean (0 errors/warnings).
`tsc --noEmit` (via `next build`) and a workspace-wide `pnpm build` both
green. Backend (328/328) and shared/types (73/73) suites unaffected, as
expected — this phase touched no backend or shared-types files.

**Deliberately out of scope for Phase 5** (per the plan, deferred to Phase
6): a comprehensive cross-talk verification sweep proving two concurrent
sessions never leak into each other's rooms end-to-end through the real
Socket.IO gateway (this phase's tests all mock `useGameSocket`/the REST
clients at the frontend boundary); removing the server's
`defaultJoinCode`/codeless-handshake fallback now that every first-party
frontend entry point supplies an explicit code (still relied upon by
`closeSession`'s default-session guard, per the Phase 4 report — revisiting
that is a backend change, not frontend wiring); an idle-timeout eviction
sweep (still explicitly rejected, unchanged from Phase 4).

## Merge evidence

Not yet committed — evidence report written prior to the commit step per
the project's TDD workflow; see the accompanying commit for this phase's
full RED→GREEN history.
