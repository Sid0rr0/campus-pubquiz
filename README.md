# Campus Pub Quiz

A live pub quiz web app for campus events. One machine displays questions on a
big screen, teams answer on their phones, and the quiz master grades answers
and controls the game from an admin laptop.

- **`/display`** — big screen (TV/projector)
- **`/admin`** — quiz master's laptop
- **`/play`** — team phones

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

- [DOCUMENTATION.md](DOCUMENTATION.md) — how the app works: game flow, state
  machine, real-time protocol, auth, persistence
- [CLAUDE.md](CLAUDE.md) — architecture decisions and conventions for
  contributors (human or AI)

## License

MIT — see [LICENSE](LICENSE).
