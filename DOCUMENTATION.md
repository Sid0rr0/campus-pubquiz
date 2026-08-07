# Campus Pub Quiz — How It Works

A live pub quiz web app for campus events. One machine shows questions on a big
screen, teams answer on their phones, and the quiz master runs the game from a
laptop. This document describes the system as currently built.

## Contents

- [System Overview](#system-overview)
- [The Three UIs](#the-three-uis)
- [Other Routes: Auth, Sessions, and Quiz Authoring](#other-routes-auth-sessions-and-quiz-authoring)
- [Game Flow: Rounds, Blocks, and the State Machine](#game-flow-rounds-blocks-and-the-state-machine)
- [Real-Time Protocol (Socket.IO)](#real-time-protocol-socketio)
- [Answer Lifecycle](#answer-lifecycle)
- [Teams: Join, Reconnect, and Kick](#teams-join-reconnect-and-kick)
- [Quiz Authoring and CSV Import](#quiz-authoring-and-csv-import)
- [Persistence and Restart Resilience](#persistence-and-restart-resilience)
- [Authentication](#authentication)
- [Sessions: Running Multiple Quizzes at Once](#sessions-running-multiple-quizzes-at-once)
- [Frontend Structure](#frontend-structure)
- [Testing](#testing)
- [Running the App](#running-the-app)
- [Known Gaps and Accepted Tradeoffs](#known-gaps-and-accepted-tradeoffs)

## System Overview

```
apps/
  frontend/    Next.js 16, React 19, Tailwind 4 — three routes in one app (port 8888)
  backend/     NestJS 11 + Socket.IO — authoritative game state + Postgres (port 3000)
shared/
  types/       @campus-pubquiz/types — game state machine, socket contract, DTOs
```

The backend owns all game state. Clients never advance the game themselves —
they render snapshots the server broadcasts and send intents (join, answer,
grade, advance, kick, award bonus). A single backend instance serves everyone
and can run several game sessions concurrently, each bound to its own join
code and Socket.IO room set; at pub-quiz scale (dozens of teams per session)
this is intentional, so there is no Redis adapter and no horizontal scaling.

Everything important is written to Postgres as it happens; the in-memory state
is a cache that can be rebuilt after a restart.

## The Three UIs

| Route      | Who                  | What it does                                                                      |
| ---------- | -------------------- | ----------------------------------------------------------------------------------- |
| `/display` | Big screen (TV)      | If no session is picked, shows a session picker; otherwise the current status screen (lobby, rules, round intro, question, locking countdown, break intro, reveal, leaderboard, ended) |
| `/admin`   | Quiz master's laptop | Bound to one session via `?code=`; state machine controls, grading, teams roster (with kick), bonus awards |
| `/play`    | Team phones          | Join by name + code (or reconnect via saved token/team code), browse open questions, submit and revise answers |

## Other Routes: Auth, Sessions, and Quiz Authoring

Beyond the three live-game surfaces, the same Next.js app serves the
management and authoring UI:

| Route            | Who                             | What it does                                                                 |
| ---------------- | -------------------------------- | ----------------------------------------------------------------------------- |
| `/`               | Anyone                          | Landing page — team join panel, plus a "Quiz master login" link             |
| `/login`          | Admin/moderator                 | Session login; redirects to `/sessions` on success                          |
| `/register`       | Prospective admin/moderator     | Self-registration; account is `pending` until an existing admin approves it |
| `/sessions`       | Admin/moderator (any)           | Lists/starts/closes game sessions; opening one routes to `/admin?code=...`  |
| `/admin/users`    | Admin only                      | Approve pending accounts, deactivate active ones                            |
| `/quizzes/[id]`   | Admin/moderator (any)           | Quiz create/edit page (`id === 'new'` for a blank draft); CSV import lives here |
| `/rules`          | Anyone, any time                | Standalone round/topic/break-structure page, computed from the active quiz  |

## Game Flow: Rounds, Blocks, and the State Machine

A quiz is a list of **rounds**, each holding ordered **questions**. Every round
has a `breakAfter` flag. The consecutive rounds between one `breakAfter: true`
round and the next form a **block** — the unit of locking and grading.

### Statuses

```
lobby → rules → round_intro → question_open → locking → break
      → break_round_intro (per round boundary crossed backward) → reveal_intro
      → reveal → (next block: round_intro …) → ended
```

- `lobby` — waiting for teams; display shows the QR code and join code.
- `rules` — a one-time screen shown once per quiz, right after `START_QUIZ`,
  before the first round starts.
- `round_intro` — a title-card beat announcing the round before its first
  question opens.
- `question_open` — the admin walks the display through questions one at a
  time with `ADVANCE`. **Every question revealed so far in the current block
  stays open**: teams can browse back and change answers (last write wins).
- `locking` — a brief transient status entered when the admin advances off the
  last question of a `breakAfter` round, on the way to `break`.
- `break` — the whole block locks at once; the admin grades its answers
  question by question, walking backward through the block with `PREVIOUS`.
  The display shows a plain "BREAK" card for the entry beat (the block's
  last question, where break starts), then mirrors whichever question is
  under review (prompt + media, no answer yet — same layout as
  `question_open`) once `PREVIOUS` steps `revealIndex` off that entry
  position.
- `break_round_intro` — a title-card beat during break review, entered
  whenever `PREVIOUS` walks `revealIndex` back onto a round's first question
  (mirroring `round_intro`/`reveal_intro`'s treatment, one per round crossed,
  including the quiz's very first round — so it stays reachable purely by
  walking `PREVIOUS`). `ADVANCE` resumes into `break` at the same
  `revealIndex`; `PREVIOUS` continues into the previous round's last question
  (still `break`, never `reveal` — these answers haven't been publicly
  revealed) or, at the block's very first question, crosses into the previous
  block's `reveal` instead of rejecting. Deliberately a separate status from
  `round_intro`/`reveal_intro`: those two treat their round as still
  live/open (open for answering, or already revealed) — reusing either here
  would either reopen a locked round for answers or leak an unrevealed one.
- `reveal_intro` / `reveal` — grading finished; the admin talks through the
  answers. `ADVANCE` moves to the next block's `round_intro`, or to `ended`
  after the final round.
- `ended` — final state; the admin can toggle the leaderboard or select a new
  quiz.

There is **no per-question locking** — locking is purely a consequence of
finishing a `breakAfter` round. A `locked` status existed in an earlier
version of the schema; it is not part of the live state machine today (that
role is now split across `locking`/`break`). Any database row still carrying
the retired `locked` value is normalized to `question_open` on load — see
[Persistence](#persistence-and-restart-resilience).

The leaderboard is deliberately _not_ a status: `isLeaderboardVisible` is a
flag the admin can toggle from any status, so hiding it always resumes exactly
where the game was.

### Admin actions

| Action                | Legal from                | Effect                                                                 |
| --------------------- | -------------------------- | ------------------------------------------------------------------------ |
| `START_QUIZ`          | `lobby`                    | → `rules`                                                              |
| `ADVANCE`              | `rules`, `round_intro`, `question_open`, `reveal`/`reveal_intro` | Steps forward through the sequence above, crossing block boundaries automatically |
| `PREVIOUS`             | most non-terminal statuses | Symmetric backward walk, including back across a block boundary into the prior block's `reveal` |
| `END_QUIZ`             | any except `ended`         | Force-end                                                              |
| `TOGGLE_LEADERBOARD`   | any                        | Flips `isLeaderboardVisible`, status untouched                        |
| `REVEAL_NEXT_TEAM`     | while leaderboard visible  | Advances the leaderboard's team-by-team reveal (no status change)     |

Grading (`GRADE_ANSWER`), kicking a team (`KICK_TEAM`), and awarding bonus
points (`AWARD_BONUS`) are **not** part of this state machine — they are
separate socket events that mutate `Answer`/`Team`/`BonusAward` rows directly
without a status transition.

The pure transition function `getNextGameState` lives in
`shared/types/src/game-state.ts`; illegal transitions throw and are surfaced
to the admin as socket exceptions. A config whose last round has
`breakAfter: false` is rejected outright (its answers could never be
revealed).

## Real-Time Protocol (Socket.IO)

Clients connect with `?role=display|admin|players`; rooms are scoped per game
session (`sessionRoom(joinCode, role)`, e.g. `admin:AB12CD`) so multiple
sessions can run concurrently without cross-talk. Admin connections (both
`admin` and `moderator` roles) must present a valid session cookie, read from
the raw `Cookie` header sent with the socket handshake (the browser attaches
it automatically since the `withCredentials: true` client option is set) —
there is no separate shared handshake password. Every connection immediately
receives a full state snapshot (`STATE_SYNC`) — reconnection is a first-class
feature, since phones sleep and venue Wi-Fi drops. If a session expires or is
revoked mid-event, only that one admin socket drops — live game state lives
server-side independent of any admin connection, so `display`/`players`
clients are unaffected; the admin just reconnects with a fresh token.

### The snapshot

`StateSnapshotPayload` is the single source of truth every client renders:

| Field             | Meaning                                                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `progress`        | Status + round/question indices + leaderboard flag                                                                                      |
| `currentQuestion` | What the big screen shows (only while `question_open`)                                                                                  |
| `blockQuestions`  | Questions open for answering (revealed-so-far during `question_open`; the whole locked block during `break`/`reveal`; empty otherwise)  |
| `answeredTeamIds` | Teams that have answered the current question — drives all response indicators                                                          |
| `leaderboard`     | Graded totals, recomputed after every grade or bonus award                                                                              |
| `joinCode`        | Six-character code for this game session                                                                                                |
| `teams`           | Connected/registered teams                                                                                                              |

### Events

Server → client: `STATE_SYNC`, `STATE_UPDATED`, `JOIN_ACCEPTED`,
`ANSWER_RECEIVED`, `ANSWERS_UPDATED` (admin only — contains answer values),
`SESSION_CLOSED`.

Client → server: `ADMIN_ACTION`, `JOIN_PLAYERS`, `SUBMIT_ANSWER`,
`GRADE_ANSWER`, `SELECT_QUIZ`, `KICK_TEAM`, `AWARD_BONUS` (all admin-only
except `JOIN_PLAYERS`/`SUBMIT_ANSWER`, which are players-only). Room
membership is checked server-side on every handler; violations raise
`WsException`. Quiz listing/creation and session lifecycle (list, start,
close) now go over REST (`/quizzes`, `/sessions`) rather than sockets — see
[Sessions](#sessions-running-multiple-quizzes-at-once).

Answer _content_ only ever goes to the admin room and the answering team
itself — the display and other players just see counts.

## Answer Lifecycle

1. **Submit** — a player sends `SUBMIT_ANSWER` for any question in
   `blockQuestions`. The server rejects submissions for questions outside the
   open block ("Answers are locked for this question") — locking is enforced
   server-side, not just hidden in the UI.
2. **Upsert** — answers are keyed `(gameSession, question, team)`;
   re-submitting overwrites (last-write-wins is the desired pub-quiz behavior).
3. **Acknowledge** — the submitter gets `ANSWER_RECEIVED`, which the phone
   uses to tick its checkmarks; the admin room gets the full `ANSWERS_UPDATED`
   list; everyone gets a fresh snapshot whose `answeredTeamIds` drives the
   admin's per-team ✓ marks and the display's "X of Y teams answered" counter.
4. **Grade** — during `break`, the admin browses the locked block
   question-by-question and awards 0 / half / full points per answer. Grades
   are written to the answer row; grading an answer twice is prevented in the
   UI.
5. **Bonus points** — separately from per-question grading, the admin can
   award ad-hoc bonus points (`AWARD_BONUS`; categories like `shot`, `selfie`,
   `custom`) to a team at any time, also folded into the leaderboard.
6. **Leaderboard** — recomputed from graded points plus bonus awards after
   every change and broadcast to all rooms; shown whenever the admin toggles
   it.

A team's saved answers ride along on `JOIN_ACCEPTED`, so a phone that
reconnects (or reopens the tab) restores its checkmarks and can still revise
anything in the open block.

## Teams: Join, Reconnect, and Kick

A `Team` is a **persistent entity independent of any single game session** —
it has a unique name, an opaque `token` (the reconnect credential held in
`localStorage`), and a human-enterable `code` (a recovery code letting a
second device join as the same team without the token). A team's membership
in one particular game session is tracked separately, in a pure roster join
table (`GameSessionTeam`).

- **New name** → creates a fresh `Team` row with a fresh token and code, and
  adds it to the session roster.
- **Existing name + saved token** → reconnects silently (adding the team to a
  *new* session's roster still requires that session's join code).
- **Existing name, no token** (e.g. a teammate's phone) → requires the team's
  recovery `code`, since a bare name match isn't proof of identity.
- **Kick** — the admin can remove a team from the *current session's roster*
  (`KICK_TEAM`) without touching the underlying `Team` entity or its answer
  history; a kicked team's persistent identity and past scores survive.
  Available only for disconnected teams in the admin UI.

## Quiz Authoring and CSV Import

The `/quizzes/[id]` page is a full quiz editor, not just an import target:

- Start from scratch (one empty round) or seed the whole quiz from a CSV
  upload — both offered on the empty-state screen.
- Edit the quiz title; per round, edit its title, toggle `breakAfter`, reorder
  with up/down buttons (no drag-and-drop), delete, or add questions; per
  question, edit type/prompt/options/answer/points/media.
- Re-import a CSV mid-edit at any time — it overwrites the current draft.
- Save via `POST /quizzes` or `PUT /quizzes/:id`, both Zod-validated
  server-side, surfacing structured issues per round/question on failure.

**CSV import mechanics**: the browser reads the uploaded file's text directly
(`file.text()`) and POSTs it to `POST /import/preview` — there is no
server-side fetch of a pasted Google Sheets URL (an earlier plan called for
that; it was changed specifically to avoid the SSRF surface a server-side
fetch of a user-supplied URL would create). The parsed rounds/questions load
straight into the in-page editable draft; saving goes through the normal quiz
endpoints above. The backend also exposes `POST /import/confirm` (upserts a
quiz directly, keyed by title, only while a session is `lobby`/`ended`), but
the current frontend doesn't call it — the shipped flow is preview → edit →
save.

Sheet row format (one row per question):

```
round | type | question | options | answer | points | media_url | answer_media_url | notes | break_after
```

`type` is one of `free_text`, `multiple_choice`, `picture`, `audio`.
`options` is pipe-separated and required (≥2) for `multiple_choice`.
`media_url` is required for `picture`/`audio`, optional otherwise.
`answer_media_url` is optional on any type (shown alongside the correct answer
during reveal). `break_after` is `''`/`0`/`1`; the **last round's break is
always forced on** regardless of its cells, since the state machine has no
other way to ever reveal it.

## Persistence and Restart Resilience

Postgres via MikroORM. Two halves of the schema:

- **Authoring time**: `quizzes → rounds → questions`. Questions have a `type`
  (`free_text`, `multiple_choice`, `picture`, `audio`) plus a JSON payload for
  type-specific data (options, media URL), so new question types don't need
  migrations.
- **Runtime**: `game_sessions → teams → answers`, plus `bonus_awards` and the
  `game_session_teams` roster join table. A session row stores the join code
  and the live progress columns (`status`, `currentRoundIndex`,
  `currentQuestionIndex`, `isLeaderboardVisible`), updated on **every**
  transition.

Entities live in `apps/backend/src/db/entities/`, one repository per entity in
`apps/backend/src/db/repositories/`, injected via `@InjectRepository`.
Migrations live in `apps/backend/src/db/migrations/` and run via
`pnpm db:migrate` / `pnpm db:migrate:prod`.

On boot the backend seeds the hardcoded demo quiz idempotently, loads
persisted sessions, and rehydrates each one's progress — a redeploy mid-quiz
means roughly ten seconds of frozen sockets, then every client resyncs from
its automatic reconnect. Answers, teams, and grades survive because they were
never only in memory.

`GameProgressRepository.load()` normalizes any row still carrying the
retired `locked` status back to `question_open`, so quiz nights that started
on an older schema version keep working without a data migration.

## Authentication

- **Admin/moderator**: per-user accounts with two roles — `admin` (everything,
  including user management) and `moderator` (everything except user
  management). New accounts self-register as `pending`; an existing admin
  approves them and assigns a role. Passwords are bcrypt-hashed; login issues
  an opaque, DB-backed session token with sliding expiration (every validated
  request/handshake pushes it forward), delivered as an httpOnly session
  cookie (`campus_pubquiz_session`, set by `POST /auth/login`). REST calls
  send it automatically (`credentials: 'include'`); the Socket.IO handshake
  reads it from the raw `Cookie` header (`extractSessionCookie`), since
  `cookie-parser`'s Express middleware doesn't run on the WS upgrade.
  Deactivating a user revokes all of its sessions immediately. The first
  admin account is bootstrapped at startup from
  `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars, since
  self-registration alone can't produce the first approver.
- **Teams**: join with a team name + the session's join code (typed or via the
  QR code on the display), or reconnect via a saved token/recovery code — see
  [Teams](#teams-join-reconnect-and-kick). Names are unique per team, not per
  session.

## Sessions: Running Multiple Quizzes at Once

The backend can run several `GameSession`s concurrently, each bound to one
`Quiz` and identified by its own join code. `/sessions` is the authenticated
admin/moderator landing page for managing them:

- `GET /sessions` — list running sessions (auth-gated).
- `POST /sessions` (`{ quizId }`) — start a new session, producing a fresh
  join code.
- `DELETE /sessions/:joinCode` — close a session; blocked mid-game (409) via
  a dedicated guard.
- `GET /sessions/public` — **unauthenticated**, so `/display` (venue TV, no
  login) can list/pick a running session without credentials. Exposes only
  join code, title, status, and team count.

Picking or starting a session in `/sessions` routes the admin to
`/admin?code=<joinCode>`, which binds that admin tab to one specific session
for the rest of the flow.

## Frontend Structure

All three live-game routes share one hook that owns the socket connection and
exposes the latest snapshot, connection state, team identity, and typed
emitters for each client→server event. Pages are thin renderers over the
snapshot:

- **PlayPage** — join form → question view with a numbered navigator over the
  open block (✓ = answered, prefilled/highlighted saved answers).
- **AdminPage** — sidebar of game actions, a teams roster (with kick) and
  live answers while a question is open, a prev/next grading browser during
  breaks, and bonus-award controls; binds to a session via `?code=`.
- **DisplayPage** — session picker (if no `?code=`), then per-status screens:
  lobby QR, rules, round intro, current question with media/options, the
  answered counter, and the leaderboard overlay.

Both apps import shared code via the `@/*` path alias and the
`@campus-pubquiz/types` workspace package — never relative `../` paths.

## Testing

Every feature lands test-first (RED commit → GREEN commit). Suites:

| Workspace       | Runner                         | What's covered                                      |
| --------------- | ------------------------------- | ----------------------------------------------------- |
| `shared/types`  | Vitest                         | State machine transitions, socket contract pin test  |
| `apps/backend`  | Jest + Testcontainers Postgres | Services, gateway handlers, real-DB integration      |
| `apps/frontend` | Vitest + Testing Library       | Hook behavior, all pages                             |

The socket contract has a pin test (`expect(SOCKET_EVENTS).toEqual({...})`) so
any protocol change forces a deliberate test update on both sides.

```bash
pnpm test          # all workspaces
pnpm lint
pnpm build
cd apps/backend && pnpm test:cov   # coverage (Testcontainers needs Docker)
```

## Running the App

```bash
pnpm dev            # frontend :8888 + backend :3000
pnpm dev:frontend   # frontend only
pnpm dev:backend    # backend only
```

Required backend env: `DATABASE_URL` (Postgres); optionally
`BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` (creates the first admin
account at startup — required until at least one admin exists) and
`FRONTEND_ORIGIN` (CORS, defaults to `http://localhost:8888`). Frontend:
`NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:3000`).

Deployment target is a single instance on Railway/Fly.io with Postgres. Do
**not** deploy the backend to Vercel — serverless and Socket.IO don't mix.

## Known Gaps and Accepted Tradeoffs

- **Answered-count cache is in-memory** — after a backend restart mid-question
  the "X of Y answered" indicators show 0 until the next submission. The
  answers themselves are safe in Postgres.
- **Venue internet is a hard dependency** — phones on mobile data are the
  mitigation; a phone hotspot can carry the two PCs if Wi-Fi dies.
- **Single backend instance, no horizontal scaling** — a redeploy drops every
  socket for ~10 seconds; clients resync automatically, no data is lost.
- **JSON payload column on `Question`** — flexible for new question types,
  but requires per-type Zod validation at import/save time or a bad payload
  crashes the flow live on stage.
- **Grading isn't attributed on `Answer` rows** — per-user accounts and
  sessions now identify who's connected to the admin room, but grading a
  specific answer doesn't yet stamp a `gradedBy` user id on it.
- **`localStorage` identity** — private browsing or cleared storage loses the
  team token (and, equivalently, the admin/moderator session token); there is
  no admin "re-link phone to team" escape hatch yet. Teams can still recover
  via their recovery code.
