# Repo audit log — 2026-10-26

Whole-repo audit (`/ponytail-audit`) at commit `138a5e1f`. Read-only: no code changed, no tests run.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; backend reachable from the open internet (phones on mobile data).

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Bootstrap | `apps/backend/src/main.ts` | trust proxy, CORS, cookie parsing | OK |
| CORS | `config/cors.config.ts` | prod allows only `FRONTEND_ORIGIN`; LAN/localhost dev-only | OK |
| Login / register | `auth/auth.controller.ts`, `auth/auth.service.ts` | throttling, no username enumeration, pending/deactivated refused | OK |
| Sessions (staff) | `auth/session.service.ts`, `auth/session-cookie.ts` | 32-byte random token, stored as SHA-256 hash, inactive user rejected, cookie flags | OK |
| Guards | `auth/session.guard.ts`, `auth/roles.guard.ts` | CSRF header on unsafe methods, role check | OK |
| User admin | `auth/users.controller.ts` | admin-only; deactivate also drops that user's sockets | OK |
| Route permissions | every `*.controller.ts` (`@Roles`, `@UseGuards`) | which routes a moderator can reach | Matches DOCUMENTATION.md |
| Socket handshake | `game/socket/connection.util.ts`, `game/game.gateway.ts` | role and join code checked, admin cookie checked at connect | OK |
| Cross-site socket hijack | `node_modules/.pnpm/engine.io@6.6.9/.../build/server.js` | does CORS run on WebSocket upgrades? | Yes, blocked |
| Socket dispatch | `game/socket/guarded-dispatch.util.ts`, `socket-event-declarations.ts`, `socket-payload.schemas.ts` | Zod on every payload, one allowed room per event | OK, but **no rate limit** (finding 3) |
| Seat ownership | `answers-changes.ts`, `team-roster-changes.ts`, `showdowns-changes.ts`, `team-feedback-changes.ts`, `team-player-count-changes.ts`, `joker-changes.ts` | player events only act on the sender's own team | OK |
| Team join | `team/team.service.ts`, `db/join-code.util.ts`, `db/entities/team.entity.ts` | token / name+code / join code paths; code keyspace | ~22M codes from `Math.random`, unthrottled over sockets (finding 3) |
| Team page | `team/team-page.controller.ts` | code guessing throttled (5/min) | OK |
| Public session list | `session/sessions.controller.ts` | exposes join codes | By design (players pick a game) |
| Write queue | `game/state/session-write.ts`, `session-write-queue.ts` | per-session ordering, failure passes the turn on, hold ordering | OK |
| Game state facade | `game/state/game-state.service.ts` | callers of each public method | `createSessionSnapshot` test-only (finding 4) |
| Answers | `answer/answer.service.ts`, `answer/grading-policy.ts` | upsert merge fields, regrade on key fix, batch-ran detection | OK |
| Backward moves | `shared/types/src/game-state-backward-transitions.ts`, `game-state.ts`, `game-state-groups.ts`, `session-snapshot.ts`, `block-in-play.ts` | can Previous reopen a locked question? | **Yes in kahoot rounds** (finding 1), reproduced with built `shared/types` |
| Phase timers | `game/socket/phase-timers.ts`, `question-lock-timer.registry.ts`, `outcome-delivery.util.ts` | timer expiry vs. a manual press | **Blind ADVANCE, can double-step** (finding 2); no spec covers it |
| Move commit | `game/state/commit-a-move.service.ts` | progress saved before the session moves | OK |
| Live results | `game/state/live-results-read.ts`, `standings/standings.service.ts` (queries only) | cost per answer submit | Aggregate queries, fine at assumed load |
| Sheet import | `import/sheet-url-fetcher.ts`, `import/import.controller.ts`, `import/import.service.ts` (URL paths) | SSRF: host pin, redirect allowlist, size and time limits | OK |
| Media upload | `media/media.controller.ts` | size limit, staff-only | OK |
| Team merge | `team/team-merge.service.ts` | transaction, row locks, refuses teams in unended sessions | OK |
| Frontend socket | `apps/frontend/app/lib/use-game-connection.ts` | socket cleanup, reconnect and refusal handling | OK |
| Frontend HTML injection | `grep` for `dangerouslySetInnerHTML` / `innerHTML` / `eval(` in `apps/frontend/app` | none found | OK |
| Boilerplate | `app.controller.ts`, `app.service.ts`, `render.yaml` | `GET /` is the health check | Service wrapper unneeded (finding 5) |

## Findings

1. Kahoot Previous reopens answers after the reveal — must fix
2. Auto-lock timer can advance one step too far — must fix
3. Socket events unthrottled: queue stall plus team-code guessing — should fix
4. `GameStateService.createSessionSnapshot` used only by tests — should fix (lean)
5. `AppService` hello-world wrapper — nice to have (lean)

## Not checked

- Most of the frontend (~27k lines); only the socket hook was read
- Scoring math and standings/stats calculations in detail (`shared/types` scoring, `stats/*.calc.ts`, `standings/session-result.ts`)
- CSV parser and question-row schema in detail; live-edit (`game/live-edit/`, `quiz/live-edit-guard.ts`)
- League, bonus, showdown, feedback and joker services beyond seat-ownership checks
- Migrations, seed service, Sentry setup, e2e suite
- Whether `trust proxy 1` matches the real proxy chain in production
- No tests or mutation runs
