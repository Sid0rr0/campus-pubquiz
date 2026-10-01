# Campus Pub Quiz

A live pub quiz web app for campus events. One machine displays questions on a
big screen, teams answer on their phones, and the quiz master grades answers
and controls the game from an admin laptop.

- **`/display`** — big screen (TV/projector)
- **`/control`** — quiz master's laptop
- **`/play`** — team phones

No apps to install and no answer sheets — teams scan a QR code and they're in.
If a phone sleeps, the Wi-Fi drops or the server restarts mid-game, everyone
reconnects and picks up exactly where they left off.

## Features

### For teams (`/play`)

- Join from any phone with a team name and join code, or by scanning the QR
  code on the big screen
- Teammates can join on a second phone using the team's recovery code
- Revise answers until the block locks
- See every question asked so far in a running history

### On the big screen (`/display`)

- Covers the whole evening: lobby with QR code, rules, round intros,
  questions, last-call countdown, breaks, answer reveals and the leaderboard
- Leaderboard revealed one rank at a time
- Showdown tiebreaks between teams tied on the leaderboard

### For the quiz master (`/control`)

- Move the quiz forward or back with Advance and Previous (with keyboard
  shortcuts)
- Grade answers live as they arrive; auto-graded types score themselves
- Fix a wrong answer key mid-game, which re-scores every answer to it
- Award bonus points, manage the team roster, remove disconnected teams
- Run several quizzes at once, each with its own join code

### Question types

- Free text, multiple choice, audio, YouTube video, sort/order, match pairs
  and closest guess
- Kahoot-style rounds, where each question is locked, scored and revealed on
  its own

### Quiz authoring

- In-browser quiz editor: rounds, questions, points, media and where the
  breaks go
- Import from CSV or a Google Sheets link; export back to CSV
- Every row is validated at import, so a broken question is caught before it
  reaches the stage
- Safe live editing: fix typos while a quiz is running without breaking the
  game

### Accounts and reliability

- Admin and moderator roles; new accounts need an admin's approval
- Everything is saved to Postgres as it happens, so a server restart loses no
  answers, teams or scores
- Teams keep their identity across quiz nights
- A built-in moderator guide at `/guide`

## Stack

Next.js 16 + React 19 frontend, NestJS 11 + Socket.IO backend, Postgres via
MikroORM, in a pnpm monorepo (`apps/frontend`, `apps/backend`,
`shared/types`).

## Quick start

```bash
pnpm install
cp apps/backend/.env.example apps/backend/.env   # set DATABASE_URL, etc.
pnpm db:migrate
pnpm dev                                          # frontend :8888, backend :3000
```

Run just one side with `pnpm dev:frontend` or `pnpm dev:backend`.

Required backend env: `DATABASE_URL` (Postgres); optionally
`BOOTSTRAP_ADMIN_USERNAME`/`BOOTSTRAP_ADMIN_PASSWORD` (creates the first admin
account at startup — required until at least one admin exists) and
`FRONTEND_ORIGIN` (CORS, defaults to `http://localhost:8888`). Frontend:
`NEXT_PUBLIC_BACKEND_URL` (defaults to `http://localhost:3000`).

Deployment target is a single cloud instance with Postgres. Do **not** deploy
the backend to Vercel — serverless and Socket.IO don't mix.

## Testing

Every feature lands test-first (RED commit → GREEN commit). Suites:

| Workspace       | Runner                         | What's covered                                      |
| --------------- | ------------------------------ | --------------------------------------------------- |
| `shared/types`  | Vitest                         | State machine transitions, socket contract pin test |
| `apps/backend`  | Jest + Testcontainers Postgres | Services, gateway handlers, real-DB integration     |
| `apps/frontend` | Vitest + Testing Library       | Hook behavior, all pages                            |

The socket contract has a pin test (`expect(SOCKET_EVENTS).toEqual({...})`) so
any protocol change forces a deliberate test update on both sides.

```bash
pnpm test          # all workspaces
pnpm lint
pnpm build
cd apps/backend && pnpm test:cov   # coverage (Testcontainers needs Docker)
```

## Docs

Each file has one job; link to it rather than repeating it elsewhere.

- [CONTEXT.md](CONTEXT.md) — the glossary: what each domain term (block,
  break, break review, question type…) means
- [DOCUMENTATION.md](DOCUMENTATION.md) — how the app works: statuses,
  real-time protocol, question types, CSV import, auth, persistence, deploy
  and CI
- [docs/adr/](docs/adr/) — why hard-to-reverse decisions were made
- [CLAUDE.md](CLAUDE.md) — commands, constraints and conventions for
  contributors (human or AI)
- `/guide` in the running app — the moderator's guide to running a quiz night

## License

MIT — see [LICENSE](LICENSE).
