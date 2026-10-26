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

- Free text, multiple choice, sort/order, match pairs, closest guess, number (any question can also carry a picture, audio or YouTube video)
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

## Running E2E

Browser end-to-end tests (Playwright, Chromium) drive `/control`, `/display`
and `/play` together against production builds of both apps. They run locally
only: not in `pnpm test`, the pre-commit hook or CI.

**Needs:** the docker-compose Postgres running (`docker compose up -d postgres`). If it
isn't, the run fails straight away with a message saying so. Nothing else has
to be set up; `pnpm install` is enough, plus a one-time
`pnpm --filter e2e exec playwright install chromium` if Chromium isn't
installed yet.

```bash
pnpm e2e                                   # build both apps, reset the DB, run every journey
E2E_SKIP_BUILD=1 pnpm e2e                  # reuse the last builds (faster when only specs changed; rebuild after pulling, the E2E frontend build bakes in a 1 s fun-fact delay)
pnpm e2e tests/happy-path.spec.ts          # one file
pnpm e2e --project=journeys                # one project
pnpm e2e --repeat-each=5                   # flakiness check
pnpm e2e:ui                                # Playwright UI mode: pick, run and time-travel through tests
pnpm e2e --project=backend-restart --no-deps --workers=1 --repeat-each=5   # flakiness check for the restart journey
pnpm --filter e2e e2e:report               # open the last HTML report
```

There are two Playwright projects. `journeys` holds every journey that shares
the backend. `backend-restart` holds the one journey that stops and restarts
that backend; it depends on `journeys`, so it runs last, on one worker. When you
repeat it with `--repeat-each`, pass `--workers=1` too, or the repeats restart
the backend under each other.

**What it uses** (separate from `pnpm dev`, so both can run at once and E2E
never touches your dev servers, `.next` or `campus_pubquiz`):

| Thing    | Dev                  | E2E                                              |
| -------- | -------------------- | ------------------------------------------------ |
| Frontend | :8888, `.next`       | :8889 (`next start`), built into `.next-e2e`     |
| Backend  | :3000                | :3001 (`node dist/main`)                         |
| Database | `campus_pubquiz`     | `campus_pubquiz_e2e` in the same Postgres server |

One run at a time: every worktree shares those ports and that database, so a
run waits on a lock (`.git/e2e-run.lock`, in the clone's git common dir) until
the run holding it finishes. A lock left by a run that died is cleared
automatically.

Every run drops and recreates `campus_pubquiz_e2e` and applies the migrations.
If your Postgres isn't the docker-compose one, set `E2E_POSTGRES_URL` to a URL
for the server's maintenance database (default
`postgres://postgres:postgres@localhost:5432/postgres`); the E2E database name
is substituted in.

**Report:** the HTML report is written to `e2e/playwright-report/`. Failed
tests also keep a trace, screenshot and video in `e2e/test-results/`. Nothing is
retried, and both folders are gitignored.

**Coverage and snapshots:** every status × screen cell (big screen, phone,
`/control`) and every move or overlay is listed in `e2e/support/coverage.ts`. A
journey covers a cell with `await snap(screen, 'break_intro')`
(`e2e/support/snapshots.ts`, API described at the top of that file), which
compares the screen's ARIA structure with a snapshot file and records the cell;
move helpers on the screen objects record their move. The check is on by
default: a full run fails, listing every cell or move no passing test visited.
Runs narrowed by file, `--project`, `--grep`, `--shard` or `--repeat-each` skip
it, and `E2E_COVERAGE=off pnpm e2e` turns it off (for example while a new
journey is still being written).

To create or refresh snapshot files, run
`pnpm e2e --update-snapshots=missing` (only absent files) or
`--update-snapshots=all` (rewrite every one), together with a long
`--timeout` (for example `--timeout=600000`), because a snapshot that doesn't
match waits out the 10 s assertion timeout before it is rewritten. The files
come out with this run's literal team names, codes and counters: hand-edit each
into a regex before committing, or the next run fails.

**Media:** URLs on `example.invalid` and `youtube.com/embed/*` are served from
stand-ins in `e2e/support/media-stub.ts`, so no journey needs the network. The
mp4 stand-in is only a box header that a `<video>` can't decode, so journeys
that pause or replay a video use `e2e/support/decodable-video.ts`, which
records a short WebM in the page itself (a few seconds of real time, once per
worker) and serves it for every `.webm` URL on `example.invalid`.

**Login throttle:** `POST /auth/login` allows 5 attempts per minute. Global
setup logs the admin in once and every test reuses that saved login, and the one
test that logs in through the UI waits for a free slot first, so
`--repeat-each` does not trip the limit. If you add a test that logs in, take a
slot with `takeLoginSlot()` (`e2e/support/login-budget.ts`) first.

## Running mutation tests

[Stryker](https://stryker-mutator.io/docs/) changes the source in small ways
(flips a `<`, drops a branch, empties a string) and runs the tests against each
change. A change no test notices ("survived") points at an assertion that's
missing. It's a local audit tool: not in `pnpm test`, the pre-commit hook or
CI, and it never fails on a low score.

```bash
pnpm mutate                                # every workspace that has it
pnpm --filter @campus-pubquiz/types mutate # shared/types only
pnpm --filter backend mutate               # backend only (DB-free slice)
pnpm --filter frontend mutate              # frontend only (non-component modules)
pnpm --filter backend mutate:db            # backend game/state/, services and logic modules with the DB specs (needs Docker, slow)
```

Runs are incremental: Stryker keeps its results in `<workspace>/reports/stryker-incremental.json`
and on the next run only retests mutants in changed code or under changed
tests. Delete that file for a clean full run. The HTML report lands in
`<workspace>/reports/mutation/mutation.html`. `reports/` and `.stryker-tmp/`
are gitignored.

**What it covers:**

- `shared/types`: all of `src/` except the tests and `index.ts`.
- `backend`: only the DB-free slice, so no Docker is needed. `apps/backend/stryker.files.cjs`
  picks it from imports on every run: it mutates source files that don't
  import `@mikro-orm`, `@nestjs` or `@/db/`, that at least one DB-free spec
  imports directly (an `@/…` or relative path), and that aren't under
  `game/state/errors/` (trivial error classes); it runs
  only the specs that don't reach the test database (`jest.stryker.config.cjs`).
  Files only DB-backed specs reach (most of `game/state/*-changes.ts`) are
  left out here; `mutate:db` covers them. A survivor in the slice may still
  be caught by a DB-backed spec Stryker didn't run.
- `backend` `mutate:db`: the files `dbSources()` in `stryker.files.cjs` picks by
  role, against every spec, DB-backed ones included (`stryker.db.config.mjs`).
  In: `game/state/` (except `errors/`), every `*.service.ts` (except
  `app.service.ts`), `game/game.gateway.ts`, the logic modules under
  `game/socket/`, `game/live-edit/` and `game/rest/`, `ended-sessions-read/`,
  `standings/cell-points.ts`, `auth/password-hash.ts` and
  `feedback/feedback-off-reason.ts`. Out: controllers, modules, guards,
  decorators, `db/`, `mikro-orm.config.ts`, the `*-http*.ts` error mappers,
  Zod schema files, socket types and event declarations, and anything the
  DB-free slice already mutates. A new service lands in the run without
  editing a list. It needs Docker:
  the wrapper (`src/test-db/mutate-db.ts`) starts one throwaway Postgres
  container for the run, gives each Stryker worker its own database, and
  stops the container afterwards. Separate from `pnpm mutate`, with its own
  `reports/stryker-db-incremental-v2.json` and `reports/mutation-db/` report.
  It's slow: run one area at a time with
  `pnpm --filter backend mutate:db --mutate src/<area>/<file>.ts,src/<area>/<other>.ts`
  (comma-separated: a repeated `--mutate` keeps only the last one);
  incremental results carry over, so the areas add up to the full baseline.
  Its timeout is 3x the covered tests' time plus 30 s (the default hid
  survivors as timeouts); a file with many timeouts left is worth a one-file
  run with `--timeoutMS 120000 --timeoutFactor 5`.
- `frontend`: the non-component `.ts` modules in `app/` (API parsers, storage
  helpers, hooks, draft state), against the whole Vitest suite. Specs, `.d.ts`
  files, `__tests__/` helpers and `.tsx` components are left out: in components
  most survivors would be Tailwind classes and display copy no test should pin.
  Stryker runs the suite from a sandbox copy, so `stryker.config.mjs` hands
  `vitest.config.ts` the real path of `shared/types` via `SHARED_TYPES_ENTRY`.

## Docs

Each file has one job; link to it rather than repeating it elsewhere.

- [GLOSSARY.md](GLOSSARY.md) — the glossary: what each domain term (block,
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
