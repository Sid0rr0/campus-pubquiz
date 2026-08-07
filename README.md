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

## Docs

- [DOCUMENTATION.md](DOCUMENTATION.md) — how the app works: game flow, state
  machine, real-time protocol, auth, persistence
- [CLAUDE.md](CLAUDE.md) — architecture decisions and conventions for
  contributors (human or AI)

## License

MIT — see [LICENSE](LICENSE).
