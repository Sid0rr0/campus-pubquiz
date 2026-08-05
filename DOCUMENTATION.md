# Campus Pub Quiz — How It Works

A live pub quiz web app for campus events. One machine shows questions on a big
screen, teams answer on their phones, and the quiz master runs the game from a
laptop. This document describes the system as currently built.

## Contents

- [System Overview](#system-overview)
- [The Three UIs](#the-three-uis)
- [Game Flow: Rounds, Blocks, and the State Machine](#game-flow-rounds-blocks-and-the-state-machine)
- [Real-Time Protocol (Socket.IO)](#real-time-protocol-socketio)
- [Answer Lifecycle](#answer-lifecycle)
- [Persistence and Restart Resilience](#persistence-and-restart-resilience)
- [Authentication](#authentication)
- [Quiz Selection](#quiz-selection)
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
grade, advance). A single backend instance serves everyone; at pub-quiz scale
(dozens of teams) this is intentional, so there is no Redis adapter and no
horizontal scaling.

Everything important is written to Postgres as it happens; the in-memory state
is a cache that can be rebuilt after a restart.

## The Three UIs

| Route      | Who                  | What it does                                                                      |
| ---------- | -------------------- | --------------------------------------------------------------------------------- |
| `/display` | Big screen (TV)      | Lobby QR code + join code, current question, answered counter, leaderboard        |
| `/admin`   | Quiz master's laptop | Start/advance/end the quiz, watch live answers, grade during breaks, pick quizzes |
| `/play`    | Team phones          | Join by name + code, browse open questions, submit and revise answers             |

## Game Flow: Rounds, Blocks, and the State Machine

A quiz is a list of **rounds**, each holding ordered **questions**. Every round
has a `breakAfter` flag. The consecutive rounds between one `breakAfter: true`
round and the next form a **block** — the unit of locking and grading.

### Statuses

```
lobby → question_open → break → reveal → (next block: question_open …) → ended
```

- `lobby` — waiting for teams; display shows the QR code and join code.
- `question_open` — the admin walks the display through questions one at a
  time with ADVANCE. **Every question revealed so far in the current block
  stays open**: teams can browse back and change answers (last write wins).
- `break` — entered automatically when the admin advances past the last
  question of a `breakAfter` round. The whole block locks at once; the admin
  grades its answers question by question.
- `reveal` — grading finished; the admin talks through the answers. ADVANCE
  moves to the next block, or to `ended` after the final round.
- `ended` — final state; the admin can toggle the leaderboard or select a new
  quiz.

There is **no per-question locking**. The former `LOCK_ANSWERS` action and
`locked` status were removed; locking is purely a consequence of finishing a
`breakAfter` round. (Old database rows that still say `locked` are read back
as `question_open`.)

The leaderboard is deliberately _not_ a status: `isLeaderboardVisible` is a
flag the admin can toggle from any status, so hiding it always resumes exactly
where the game was.

### Admin actions

| Action               | Legal from           | Effect                                                    |
| -------------------- | -------------------- | --------------------------------------------------------- |
| `START_QUIZ`         | `lobby`              | Opens round 0, question 0                                 |
| `ADVANCE`            | `question_open`      | Next question; past a `breakAfter` round's last → `break` |
| `ADVANCE`            | `reveal`             | Next block's first question, or `ended` after the last    |
| `FINISH_GRADING`     | `break`              | → `reveal`                                                |
| `END_QUIZ`           | any (except `ended`) | Force-end                                                 |
| `TOGGLE_LEADERBOARD` | any                  | Flips `isLeaderboardVisible`, status untouched            |

The pure transition function `getNextGameState` and the block helper
`getBlockStartRoundIndex` live in `shared/types/src/game-state.ts`; illegal
transitions throw and are surfaced to the admin as socket exceptions. A config
whose last round has `breakAfter: false` is rejected outright (its answers
could never be revealed).

## Real-Time Protocol (Socket.IO)

Clients connect with `?role=display|admin|players` and are joined to a room of
the same name. Admin connections (both `admin` and `moderator` roles) must
also present a valid session cookie, read from the raw `Cookie` header sent
with the socket handshake (the browser attaches it automatically since the
`withCredentials: true` client option is set). Every connection immediately
receives a full state snapshot (`STATE_SYNC`) —
reconnection is a first-class feature, since phones sleep and venue Wi-Fi
drops. If a session expires or is revoked mid-event, only that one admin
socket drops — live game state lives server-side independent of any admin
connection, so `display`/`players` clients are unaffected; the admin just
reconnects with a fresh token.

### The snapshot

`StateSnapshotPayload` is the single source of truth every client renders:

| Field             | Meaning                                                                                                                                |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| `progress`        | Status + round/question indices + leaderboard flag                                                                                      |
| `currentQuestion` | What the big screen shows (only while `question_open`)                                                                                  |
| `blockQuestions`  | Questions open for answering (revealed-so-far during `question_open`; the whole locked block during `break`/`reveal`; empty otherwise)  |
| `answeredTeamIds` | Teams that have answered the current question — drives all response indicators                                                          |
| `leaderboard`     | Graded totals, recomputed after every grade                                                                                             |
| `joinCode`        | Six-character code for this game session                                                                                                |
| `teams`           | Connected/registered teams                                                                                                              |

### Events

Server → client: `STATE_SYNC`, `STATE_UPDATED`, `JOIN_ACCEPTED`,
`ANSWER_RECEIVED`, `ANSWERS_UPDATED` (admin only — contains answer values),
`QUIZZES_LISTED`.

Client → server: `ADMIN_ACTION`, `JOIN_PLAYERS`, `SUBMIT_ANSWER`,
`GRADE_ANSWER`, `LIST_QUIZZES`, `SELECT_QUIZ`, `LIST_ANSWERS` (all admin-only
except `JOIN_PLAYERS`/`SUBMIT_ANSWER`, which are players-only). Room
membership is checked server-side on every handler; violations raise
`WsException`.

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
   question-by-question (each step requests that question's answers via
   `LIST_ANSWERS`) and awards 0 / half / full points per answer. Grades are
   written to the answer row; grading an answer twice is prevented in the UI.
5. **Leaderboard** — recomputed from graded points after every grade and
   broadcast to all rooms; shown whenever the admin toggles it.

A team's saved answers ride along on `JOIN_ACCEPTED`, so a phone that
reconnects (or reopens the tab) restores its checkmarks and can still revise
anything in the open block.

## Persistence and Restart Resilience

Postgres via Drizzle. Two halves of the schema:

- **Authoring time**: `quizzes → rounds → questions`. Questions have a `type`
  (`free_text`, `multiple_choice`, `picture`, `audio`) plus a JSON payload for
  type-specific data (options, media URL), so new question types don't need
  migrations.
- **Runtime**: `game_sessions → teams → answers`. A session row stores the
  join code and the live progress columns (`status`, `currentRoundIndex`,
  `currentQuestionIndex`, `isLeaderboardVisible`), updated on **every**
  transition.

On boot the backend seeds the hardcoded demo quiz idempotently, loads the
_newest_ game session, and rehydrates its progress — a redeploy mid-quiz means
roughly ten seconds of frozen sockets, then every client resyncs from its
automatic reconnect. Answers, teams, and grades survive because they were
never only in memory.

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
  admin account is bootstrapped at
  startup from `BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` env vars,
  since self-registration alone can't produce the first approver.
- **Teams**: join with a team name + the session's join code (typed or via the
  QR code on the display). The server issues a team token, stored in
  `localStorage`; presenting it on reconnect restores the team identity even
  after a page refresh. Names are unique per session.

## Quiz Selection

While in `lobby` or `ended`, the admin sees every quiz in the database and can
pick one (or restart the active one). Selecting a quiz creates a **fresh game
session** with a new join code and resets teams, leaderboard, and indicators —
so answers from a previous session can never leak into a new game's
leaderboard. Teams on the play page automatically re-join when they see the
game return to the lobby.

## Frontend Structure

All three routes share one hook, `app/lib/use-game-socket.ts`, which owns the
socket and exposes: the latest `snapshot`, `connectionError`, the team
identity + `myAnswers` (players), `liveAnswers` (admin), and typed emitters
(`sendAction`, `joinTeam`, `submitAnswer`, `gradeAnswer`, `requestQuizzes`,
`selectQuiz`, `listAnswers`). Pages are thin renderers over the snapshot:

- **PlayPage** — join form → question view with a numbered navigator over the
  open block (✓ = answered, prefilled/highlighted saved answers).
- **AdminPage** — sidebar of game actions and connected teams (with answered
  ✓ marks), quiz picker in lobby/ended, live answers while a question is open,
  and a prev/next grading browser during breaks.
- **DisplayPage** — lobby QR + scattered team names, the current question with
  media/options, the answered counter, and the leaderboard overlay.

Both apps import shared code via the `@/*` path alias and the
`@campus-pubquiz/types` workspace package — never relative `../` paths.

## Testing

Every feature lands test-first (RED commit → GREEN commit). Suites:

| Workspace       | Runner                         | What's covered                                      |
| --------------- | ------------------------------ | --------------------------------------------------- |
| `shared/types`  | Vitest                         | State machine transitions, socket contract pin test |
| `apps/backend`  | Jest + Testcontainers Postgres | Services, gateway handlers, real-DB integration     |
| `apps/frontend` | Vitest + Testing Library       | Hook behavior, all three pages                      |

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
- **Grading isn't attributed on `Answer` rows** — per-user accounts and
  sessions now identify who's connected to the admin room, but grading a
  specific answer doesn't yet stamp a `gradedBy` user id on it.
- **`localStorage` identity** — private browsing or cleared storage loses the
  team token; there is no admin "re-link phone to team" escape hatch yet.
- **Not built yet** (Milestone 3, planned in
  `.claude/plans/milestone-3.plan.md`): Google Sheets CSV import with a
  validation preview, and richer media rendering (audio playback, dedicated
  picture-round layout) beyond the current `mediaUrl` image on the display.
