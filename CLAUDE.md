# Campus Pub Quiz — Project Guide

## What This Is

A live pub quiz web app for campus events. One machine displays questions on a big screen, teams answer on their phones, and the quiz master grades answers and controls the game from an admin laptop.

## Monorepo Structure

```text
apps/
  frontend/    Next.js 16, React 19, Tailwind 4 — three routes in one app
  backend/     NestJS 11, Socket.IO — game logic + REST API
shared/
  types/       shared TS types, socket event names, DTOs
```

Run both with `pnpm dev`. Frontend on port 8888, backend on port 3000.

## Three UIs (one Next.js app, three routes)

| Route | Who uses it | Purpose |
|---|---|---|
| `/display` | Big screen (TV/projector) | Current question, media, countdown, leaderboard between rounds |
| `/admin` | Quiz master's laptop | Advance questions, watch live answers, grade free-text, award points |
| `/play` | Team phones | Join via QR + team name, see question, submit answers |
| `/rules` | Anyone, any time | Standalone rules page (round/topic/break structure + house rules), also shown in-game during the `rules` status |

## Architecture Decisions

### Real-time: Socket.IO gateway (NestJS)

The backend owns authoritative game state as a round-aware state machine:
`lobby → rules → question_open → locked → break → reveal → ended`

Grading happens inside `break` (no separate grading status). Rounds carry a `breakAfter` flag, so "grade after every N rounds" is data, not a hardcoded loop — `break`/`reveal` only fire once a round with `breakAfter: true` finishes. The leaderboard is **not** a state — it's a separate `isLeaderboardVisible` flag the admin can toggle from any status, so hiding it always resumes exactly where things were.

`rules` is a one-time screen shown once per quiz, right after `START_QUIZ`, before any question opens — the admin dismisses it with `ADVANCE` (same action that later steps through questions). Its round/topic/break sentence is computed from the active quiz's rounds via `getQuizStructureSummary` (rounds grouped into "blocks" by `breakAfter`, same grouping the reveal/grading flow already uses), not hardcoded.

Only admin actions advance the state. Clients in three rooms (`display`, `admin`, `players`) receive broadcasts. On reconnect, any client receives the full current state snapshot — reconnection is a **core feature**, not a nice-to-have (phones sleep, networks drop).

### Persistence: Postgres + MikroORM

Process restarts must not lose data. Every submitted answer and score is written to the DB. In-memory state is always rebuildable from it. Key schema:

- `Quiz → Round → Question` (authoring-time)
- `GameSession → Team → Answer` (runtime)
- `Question` has a `type` enum + JSON `payload` column for extensibility (new types without migrations)

Entities live in `apps/backend/src/db/entities/`, one class per table, each extending `BaseEntity` (`apps/backend/src/db/entities/base.entity.ts`) for a shared auto-increment `id` plus `createdAt`/`updatedAt` (via a `TimestampedEntity` mapped superclass). `game_session_teams` is a pure join table with a composite PK and extends `TimestampedEntity` directly, skipping the surrogate `id`. Data access goes through one repository per entity (`apps/backend/src/db/repositories/`) injected into services via `@InjectRepository` — services never touch the `EntityManager` directly except for `persistAndFlush`/`upsert`/`nativeDelete` calls scoped to their own repository. IDs are sequential integers (Postgres `serial`), not UUIDs.

Migrations live in `apps/backend/src/db/migrations/` (one squashed initial migration as of the MikroORM cutover) and run via `pnpm db:migrate` (`mikro-orm migration:up`) locally or `pnpm db:migrate:prod` (`node dist/scripts/migrate.js`) in deploys. Generate a new migration after an entity change with `pnpm db:migrate:create`.

### Auth

- Admin/moderator: per-user accounts with two roles — `admin` (everything, including user management) and `moderator` (everything except user management). Self-registration creates a `pending` account; an existing admin approves it and assigns a role before it can log in. Passwords are bcrypt-hashed (`bcryptjs`); login issues an opaque, DB-backed session token (`Session` entity) with sliding expiration, delivered as an httpOnly cookie (`campus_pubquiz_session`) rather than a token the frontend handles directly. REST requests send it automatically via `credentials: 'include'` (checked by `SessionGuard`/`RolesGuard`); the Socket.IO handshake reads it from the raw `Cookie` header (`extractSessionCookie` in `session-cookie.ts`), since `cookie-parser`'s middleware doesn't run on the WS upgrade. Deactivating a user revokes all of its sessions immediately. The first admin is bootstrapped at startup from `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars (`AuthBootstrapService`), since self-registration alone can never produce the first approver — a no-op once any admin exists.
- Teams: short join code per game session → token stored in `localStorage`. Token survives page refresh; reconnecting restores team identity.

### Question import: Google Sheets → CSV

Sheets are shared "anyone with link can view" — import parses the CSV export URL. No Google API credentials needed. Authors get full Google collaboration.

Sheet format (one row per question):

```cvs
round | type | question | options | answer | points | media_url | answer_media_url | notes | break_after
```

`options` is pipe-separated for multiple choice (e.g. `Paris|London|Berlin|Rome`).

`answer_media_url` is optional and shown alongside the correct answer during reveal, independent of the question's own `media_url` and `type` — e.g. a `free_text` question can reveal a photo. Display infers image vs. audio from the URL's file extension rather than a separate type column.

`break_after` is optional and per-row; a round grades after itself once any of its rows has `break_after` = `1` (blank/`0` = no break). The last round always breaks regardless of its `break_after` cells — the state machine has no way to reveal answers otherwise, so import forces it on rather than requiring authors to remember it.

Import shows a validation preview before saving (unknown type, missing answer, broken URL). Re-import is idempotent — updates in place so authors can keep editing until quiz night.

**Security note:** Keep the sheet URL a secret. Restrict sharing after import, or keep answers in a separate hidden sheet. The link is effectively your answer key.

### Hosting: Cloud (Railway or Fly.io)

Both apps deployed together with Postgres. Venue internet is a hard dependency — mitigation is that phones on mobile data just work, and a phone hotspot can carry the two PCs if Wi-Fi dies. **Do not deploy the backend to Vercel** — serverless and Socket.IO are incompatible.

One backend instance only. No horizontal scaling, no Redis adapter. At pub-quiz scale (dozens of teams) this is intentional and correct.

## Known Tradeoffs (Accepted)

- **Internet dependency at venue** — deliberate. Phones-on-mobile-data is the UX win.
- **Single backend instance** — redeploy drops all sockets (~10s freeze, no data loss). Reconnect/resync path must be built and tested early.
- **JSON payload column** — flexible for new question types; requires per-type Zod validation at import time or crashes will happen live on stage.
- **Last-write-wins answers** — teams can revise until question locks. This is the desired pub-quiz behavior.
- **localStorage tokens** — private browsing or cleared storage loses team identity (this now also applies to admin/moderator session tokens, matching the existing team-token precedent). Admin needs a "re-link phone to team" escape hatch.
- **Grading isn't attributed on `Answer` rows** — sessions identify who's connected to the admin room, but grading a specific answer doesn't yet stamp a `gradedBy` user id. Smaller residual tradeoff now that per-user accounts exist; fine until an audit trail of who-graded-what is needed.

## Question Types Planned

- Free-text (human-graded)
- Multiple choice (optionally auto-graded)
- Picture / media rounds (image or audio URL shown on display screen)
- Grouped into named rounds with per-round scoring

## First Milestone (done)

1. `shared/types` — game state machine types + socket event names
2. Drizzle schema — `Quiz/Round/Question` + `GameSession/Team/Answer`
3. NestJS gateway — state machine + room broadcasts
4. Three bare-bones routes with a hardcoded quiz (no DB yet)

Evidence: `.claude/tdd/milestone-1.tdd.md`.

## Second Milestone (done) — Playable Quiz

1. Idempotent startup seed from the hardcoded quiz into real Postgres rows
2. Team join (`JOIN_PLAYERS`) with token-based reconnect, admin handshake password guard
3. Answer submission (`SUBMIT_ANSWER`, last-write-wins) with live admin-only answer broadcasts
4. Grading (`GRADE_ANSWER`) and a real leaderboard computed from graded points
5. Restart resilience — `GameProgress` persisted to `game_sessions` on every transition and rehydrated on boot
6. Full frontend wiring: `PlayPage` join + answer submission, `AdminPage` grading panel + leaderboard preview, `DisplayPage` real leaderboard

Evidence: `.claude/tdd/milestone-2.tdd.md`.

## Third Milestone (done) — CSV Import + Media Rounds

1. Shared `SheetRow`/`ImportPreview`/`ImportRequest` (`csvText`, not a sheet URL) contract in `shared/types`
2. Backend CSV parsing (`sheet-csv.parser.ts`, BOM/header-tolerant) + per-type Zod validation (`question-row.schema.ts`)
3. `ImportService`: pure `preview()`, idempotent `confirm()` upserting on `(quiz/round, orderIndex)` unique indexes, lobby/ended-only locking, active-quiz reload on re-import
4. `POST /import/preview` and `POST /import/confirm`, guarded by an admin-only guard (mirrored the socket handshake password check at the time; both now use `SessionGuard`/`RolesGuard`, see "Auth" above)
5. Admin `ImportPanel`: upload a CSV file → preview table with per-row issues → confirm gated on `isImportable`, wired into the lobby/ended quiz picker
6. Display renders `picture` questions as `<img>` and `audio` questions as an autoplaying `<audio controls>`; PlayPage shows a "Look at the screen" hint for both

Evidence: `.claude/tdd/milestone-3.tdd.md`.

**Note on the import flow:** the plan originally called for pasting a Google
Sheets share URL (server-fetched, SSRF-guarded via a `docs.google.com`
allowlist). Mid-implementation this was changed to uploading an exported CSV
file instead — the browser reads the file and POSTs its text, so there is no
server-side fetch of a user-supplied URL and no SSRF surface. The "Answer key
leakage" risk from the original plan is mitigated the same way either
approach would: the CSV is only ever sent to `/import/preview`/`/import/confirm`
behind the admin password guard, and `SeedService` strips the stored answer
from every player-facing `QuestionView`.

## Backend Import Convention

Backend (`apps/backend`) source and test files import via the `@/*` path alias (mapped to `src/*` in `tsconfig.json`), never relative `./`/`../` paths.

## Frontend Import Convention

Frontend (`apps/frontend`) source and test files import via the `@/*` path alias (mapped to the workspace root in `tsconfig.json`, e.g. `@/app/lib/use-game-socket`), never relative `./`/`../` paths. Vitest resolves the same alias via a manual `resolve.alias` entry in `vitest.config.ts`.

## Git Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#commit-message-with-scope) with a **scope** naming the workspace touched:

```text
<type>(<scope>): <description>
```

- Types: `feat`, `fix`, `test`, `refactor`, `docs`, `chore`, `perf`, `ci` (matches the global git-workflow convention)
- Scopes: `shared-types`, `backend`, `frontend`, `repo` (root-level/tooling changes not scoped to one workspace)

Examples: `feat(backend): implement GameGateway`, `test(shared-types): add reproducer for game state machine`, `docs(repo): update CLAUDE.md`.

## Useful Commands

```bash
pnpm dev              # run frontend + backend in parallel
pnpm dev:frontend     # frontend only (port 8888)
pnpm dev:backend      # backend only (port 3000)
pnpm build            # build all
pnpm test             # test all
pnpm lint             # lint all
```
