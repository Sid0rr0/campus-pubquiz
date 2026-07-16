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

## Architecture Decisions

### Real-time: Socket.IO gateway (NestJS)

The backend owns authoritative game state as a round-aware state machine:
`lobby → question_open → locked → break → reveal → ended`

Grading happens inside `break` (no separate grading status). Rounds carry a `breakAfter` flag, so "grade after every N rounds" is data, not a hardcoded loop — `break`/`reveal` only fire once a round with `breakAfter: true` finishes. The leaderboard is **not** a state — it's a separate `isLeaderboardVisible` flag the admin can toggle from any status, so hiding it always resumes exactly where things were.

Only admin actions advance the state. Clients in three rooms (`display`, `admin`, `players`) receive broadcasts. On reconnect, any client receives the full current state snapshot — reconnection is a **core feature**, not a nice-to-have (phones sleep, networks drop).

### Persistence: Postgres + Drizzle

Process restarts must not lose data. Every submitted answer and score is written to the DB. In-memory state is always rebuildable from it. Key schema:

- `Quiz → Round → Question` (authoring-time)
- `GameSession → Team → Answer` (runtime)
- `Question` has a `type` enum + JSON `payload` column for extensibility (new types without migrations)

### Auth

- Admin: single shared password via env var → signed cookie. No accounts.
- Teams: short join code per game session → token stored in `localStorage`. Token survives page refresh; reconnecting restores team identity.

### Question import: Google Sheets → CSV

Sheets are shared "anyone with link can view" — import parses the CSV export URL. No Google API credentials needed. Authors get full Google collaboration.

Sheet format (one row per question):

```cvs
round | type | question | options | answer | points | media_url | notes
```

`options` is pipe-separated for multiple choice (e.g. `Paris|London|Berlin|Rome`).

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
- **localStorage tokens** — private browsing or cleared storage loses team identity. Admin needs a "re-link phone to team" escape hatch.
- **Shared admin password** — no per-user attribution. Fine until you have multiple graders and need an audit trail.

## Question Types Planned

- Free-text (human-graded)
- Multiple choice (optionally auto-graded)
- Picture / media rounds (image or audio URL shown on display screen)
- Grouped into named rounds with per-round scoring

## First Milestone

1. `shared/types` — game state machine types + socket event names
2. Drizzle schema — `Quiz/Round/Question` + `GameSession/Team/Answer`
3. NestJS gateway — state machine + room broadcasts
4. Three bare-bones routes with a hardcoded quiz (no DB yet)

Sheets import, media support, and grading UI come after the live loop works end-to-end.

## Backend Import Convention

Backend (`apps/backend`) source and test files import via the `@/*` path alias (mapped to `src/*` in `tsconfig.json`), never relative `./`/`../` paths.

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
