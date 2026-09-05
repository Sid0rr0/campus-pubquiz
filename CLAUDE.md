# Campus Pub Quiz — Project Guide

## What This Is

A live pub quiz web app for campus events. One machine displays questions on a big screen, teams answer on their phones, and the quiz master grades answers and controls the game from an admin laptop.

## Three UIs (one Next.js app, three routes)

| Route      | Who uses it               | Purpose                                                                                                         |
| ---------- | ------------------------- | --------------------------------------------------------------------------------------------------------------- |
| `/display` | Big screen (TV/projector) | Current question, media, countdown, leaderboard between rounds                                                  |
| `/control` | Quiz master's laptop      | Advance questions, watch live answers, grade free-text, award points                                            |
| `/play`    | Team phones               | Join via QR + team name, see question, submit answers                                                           |
| `/rules`   | Anyone, any time          | Standalone rules page (round/topic/break structure + house rules), also shown in-game during the `rules` status |

## Development Commands

pnpm workspace, run from repo root unless noted:

- `pnpm dev` — all workspaces in parallel; `pnpm dev:backend` / `pnpm dev:frontend` for just one
- `pnpm build` / `pnpm lint` / `pnpm test` — run across all workspaces
- Backend (`apps/backend`) uses **Jest**: `pnpm --filter backend test <path>` to run a single spec, not the whole suite
- Frontend (`apps/frontend`) uses **Vitest**: `pnpm --filter frontend test <path>` to run a single spec
- `pnpm --filter backend db:migrate` applies pending MikroORM migrations locally (Postgres must be running — see `docker-compose.yml`); `db:migrate:create` generates one after an entity change

## Architecture Decisions

### Real-time: Socket.IO gateway (NestJS)

The backend owns authoritative game state as a round-aware state machine:
`lobby → rules → question_open → locked → break → reveal → ended`

Grading happens inside `break` (no separate grading status). Rounds carry a `breakAfter` flag, so "grade after every N rounds" is data, not a hardcoded loop — `break`/`reveal` only fire once a round with `breakAfter: true` finishes. The leaderboard is **not** a state — it's a separate `isLeaderboardVisible` flag the admin can toggle from any status, so hiding it always resumes exactly where things were.

`rules` is a one-time screen shown once per quiz, right after `START_QUIZ`, before any question opens — the admin dismisses it with `ADVANCE` (same action that later steps through questions). Its round/topic/break sentence is computed from the active quiz's rounds via `getQuizStructureSummary` (rounds grouped into "blocks" by `breakAfter`, same grouping the reveal/grading flow already uses), not hardcoded.

Only admin actions advance the state. Clients in three rooms (`display`, `admin`, `players`) receive broadcasts. On reconnect, any client receives the full current state snapshot — reconnection is a **core feature**, not a nice-to-have (phones sleep, networks drop).

### Auth

- Admin/moderator: per-user accounts with two roles — `admin` (everything, including user management) and `moderator` (everything except user management). Self-registration creates a `pending` account; an existing admin approves it and assigns a role before it can log in. Passwords are bcrypt-hashed (`bcryptjs`); login issues an opaque, DB-backed session token (`Session` entity) with sliding expiration, delivered as an httpOnly cookie (`campus_pubquiz_session`) rather than a token the frontend handles directly. REST requests send it automatically via `credentials: 'include'` (checked by `SessionGuard`/`RolesGuard`); the Socket.IO handshake reads it from the raw `Cookie` header (`extractSessionCookie` in `session-cookie.ts`), since `cookie-parser`'s middleware doesn't run on the WS upgrade. Deactivating a user revokes all of its sessions immediately. The first admin is bootstrapped at startup from `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars (`AuthBootstrapService`), since self-registration alone can never produce the first approver — a no-op once any admin exists.
- Teams: short join code per game session → token stored in `localStorage`. Token survives page refresh; reconnecting restores team identity.

### Question types

`QuestionType` (`shared/types`) is the single source of truth — seven types, each with different grading:

- **`free_text`** — any typed answer. Always human-graded by the admin during `break`; there's no auto-match to fall back to.
- **`multiple_choice`** — pick one of `options`. Auto-graded at `SUBMIT_ANSWER` time by exact match against the stored answer.
- **`audio`** — an audio `mediaUrl` plays on `/display`; the question itself can be any answer style but is treated like `free_text` for grading (human-graded).
- **`youtube`** — a YouTube `mediaUrl`, optionally clipped to `mediaStartSeconds`/`mediaEndSeconds` (derived from the CSV `notes` column). Human-graded like `free_text`.
- **`sort`** — teams reorder `options` into what they think is the correct order; graded by exact match against the pipe-joined correct order, at submit time.
- **`match`** — teams pair `options` (left) with `matchTargets` (right); graded by exact match against the pipe-joined correct pairing, at submit time.
- **`closest_guess`** — teams submit a number; the correct answer is numeric. Unlike every other type this can't be graded per-answer as it arrives — it's graded in one batch (`gradeClosestGuess`) once the question locks, comparing every team's guess by distance from the target. Every team tied for smallest distance gets full points, no partial credit; everyone else gets zero.

`multiple_choice`/`sort`/`match` are auto-graded (`AUTO_GRADED_TYPES` in `answer.service.ts`); `free_text`/`audio`/`youtube` need the admin's judgment; `closest_guess` is auto-graded but deferred to a batch pass. Any type can carry `mediaUrl`/`answerMediaUrl` — image vs. audio vs. YouTube is inferred from the URL, not tied to a specific type (there is deliberately no dedicated `picture` type).

### Question import: Google Sheets → CSV

Import works by uploading an **exported CSV file**.

Sheet format (one row per question):

```cvs
round | type | question | options | answer | points | media_url | answer_media_url | notes | break_after
```

`options` is pipe-separated for multiple choice (e.g. `Paris|London|Berlin|Rome`).

`answer_media_url` is optional and shown alongside the correct answer during reveal, independent of the question's own `media_url` and `type` — e.g. a `free_text` question can reveal a photo. Display infers image vs. audio from the URL's file extension rather than a separate type column.

`break_after` is optional and per-row; a round grades after itself once any of its rows has `break_after` = `1` (blank/`0` = no break). The last round always breaks regardless of its `break_after` cells — the state machine has no way to reveal answers otherwise, so import forces it on rather than requiring authors to remember it.

### Hosting: Cloud

Both apps deployed together with Postgres. Venue internet is a hard dependency — mitigation is that phones on mobile data just work, and a phone hotspot can carry the two PCs if Wi-Fi dies. **Do not deploy the backend to Vercel** — serverless and Socket.IO are incompatible.

One backend instance only. No horizontal scaling, no Redis adapter. At pub-quiz scale (dozens of teams) this is intentional and correct.

## Known Tradeoffs (Accepted)

- **Internet dependency at venue** — deliberate. Phones-on-mobile-data is the UX win.
- **Single backend instance** — redeploy drops all sockets (~10s freeze, no data loss). Reconnect/resync path must be built and tested early.
- **JSON payload column** — flexible for new question types; requires per-type Zod validation at import time or crashes will happen live on stage.
- **Last-write-wins answers** — teams can revise until question locks. This is the desired pub-quiz behavior.
- **localStorage tokens** — private browsing or cleared storage loses team identity (this now also applies to admin/moderator session tokens, matching the existing team-token precedent). Admin needs a "re-link phone to team" escape hatch.
- **Grading isn't attributed on `Answer` rows** — sessions identify who's connected to the admin room, but grading a specific answer doesn't yet stamp a `gradedBy` user id. Smaller residual tradeoff now that per-user accounts exist; fine until an audit trail of who-graded-what is needed.

Completed-milestone implementation detail (including which question types exist) lives in `.claude/tdd/milestone-*.tdd.md`, not here — this file only tracks decisions and constraints future work must respect, since a changelog of finished work goes stale (and duplicates git history and code) faster than anyone remembers to update it.

## Git Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#commit-message-with-scope) with a **scope** naming the workspace touched:

```text
<type>(<scope>): <description>
```

- Types: `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test` (matches the global git-workflow convention)
- Scopes: `shared-types`, `backend`, `frontend`, `repo` (root-level/tooling changes not scoped to one workspace)

Examples: `feat(backend): implement GameGateway`, `test(shared-types): add reproducer for game state machine`, `docs(repo): update CLAUDE.md`.
