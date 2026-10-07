# Campus Pub Quiz — Project Guide

A live pub quiz web app for campus events: a big screen (`/display`) shows the questions, teams answer on their phones (`/play`), and the quiz master runs the game from a laptop (`/control`).

This file holds only the commands, constraints and conventions future work must respect. Everything else has one home — link to it rather than re-explaining it here:

| Question                                                                   | Where it's answered                                              |
| -------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| What does a domain term mean (block, break, break review, question type…)? | [`GLOSSARY.md`](GLOSSARY.md)                                     |
| How does it work: statuses, protocol, question types, CSV, auth, deploy?   | [`DOCUMENTATION.md`](DOCUMENTATION.md)                           |
| How is it put together (modules, flows, data model — as diagrams)?         | [`docs/architecture.md`](docs/architecture.md)                   |
| What rules must code follow?                                               | [`CODING_STANDARDS.md`](CODING_STANDARDS.md)                     |
| Why was a hard-to-reverse decision made?                                   | [`docs/adr/`](docs/adr/)                                         |
| How does a moderator run a quiz night?                                     | The in-app `/guide` page (`apps/frontend/app/guide/`)            |
| How do I set the repo up?                                                  | [`README.md`](README.md)                                         |
| What's being worked on?                                                    | `.scratch/<feature>/` issues (see [Agent skills](#agent-skills)) |

## Development Commands

pnpm workspace, run from repo root unless noted:

- `pnpm dev` — all workspaces in parallel; `pnpm dev:backend` / `pnpm dev:frontend` for just one
- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all workspaces; the pre-commit hook and CI both run `typecheck`
- Backend (`apps/backend`) uses **Jest**: `pnpm --filter backend test <path>` to run a single spec, not the whole suite
- Frontend (`apps/frontend`) uses **Vitest**: `pnpm --filter frontend test <path>` to run a single spec
- `pnpm --filter backend db:migrate` applies pending MikroORM migrations locally (Postgres must be running — see `docker-compose.yml`); `db:migrate:create` generates one after an entity change

## Constraints

- **Code follows [`CODING_STANDARDS.md`](CODING_STANDARDS.md).** Read it before writing or reviewing code: server-owned game state, the reconnect path, the question type registry, boundary validation.
- **Hosting:** both apps deploy together with Postgres. **Do not deploy the backend to Vercel** — serverless and Socket.IO are incompatible. One backend instance only: no horizontal scaling, no Redis adapter; at pub-quiz scale that's intentional.

## Known Tradeoffs (Accepted)

- **Internet dependency at venue** — deliberate. Phones-on-mobile-data is the UX win; a phone hotspot can carry the two PCs if Wi-Fi dies.
- **Single backend instance** — redeploy drops all sockets (~10s freeze, no data loss). Reconnect/resync path must be built and tested early.
- **JSON payload column** — flexible for new question types; requires per-type Zod validation at import time or crashes will happen live on stage.
- **Last-write-wins answers** — teams can revise until the block locks. This is the desired pub-quiz behavior.
- **localStorage tokens** — private browsing or cleared storage loses team identity (admin/moderator session cookies have the same weakness). Admin needs a "re-link phone to team" escape hatch.
- **Live answer-key fixes overwrite manual overrides** — correcting a shown auto-graded question's answer/points during a live session re-scores every answer to it, discarding any per-answer override (e.g. adjusted `match` partial credit); the admin re-overrides in break if needed. Typed-answer types (`free_text`/`audio`/`youtube`) are the exception: the moderator's grade on a non-matching answer survives a key fix. "Graded automatically" is inferred by re-running the submit-time grade against the pre-edit key, so a moderator grade identical to that automatic grade (e.g. confirming a match) is cleared by a later key fix that no longer matches it.
- **Grading isn't attributed on `Answer` rows** — grading a specific answer doesn't stamp a `gradedBy` user id. Fine until an audit trail of who-graded-what is needed.

## Keeping docs current

A change updates the doc that owns what it changed, in the same commit:

- a new or changed domain term → `GLOSSARY.md`
- changed behaviour (statuses, protocol, question types, CSV, auth, deploy) → `DOCUMENTATION.md`
- a change to what the moderator sees or does on `/control` → the `/guide` page

Completed-milestone history lives in `.claude/tdd/milestone-*.tdd.md` and git, not in any of the above.

## Git Commit Convention

[Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/#commit-message-with-scope) with a **scope** naming the workspace touched:

```text
<type>(<scope>): <description>
```

- Types: `feat`, `fix`, `build`, `chore`, `ci`, `docs`, `style`, `refactor`, `perf`, `test` (matches the global git-workflow convention)
- Scopes: `shared-types`, `backend`, `frontend`, `repo` (root-level/tooling changes not scoped to one workspace)

Examples: `feat(backend): implement GameGateway`, `test(shared-types): add reproducer for game state machine`, `docs(repo): update CLAUDE.md`.

## Agent skills

### Issue tracker

Issues live as local markdown files under `.scratch/<feature>/`. See `docs/agents/issue-tracker.md`.

### Triage labels

Default five-role vocabulary (`needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`), recorded as a `Status:` line in each issue file. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: one root `GLOSSARY.md` plus `docs/adr/`, created lazily. See `docs/agents/domain.md`.

### Skill edits

Editing a skill under `.claude/skills/`: log the change in `docs/agents/skill-changes.md`, since skill files are gitignored and reinstalls overwrite them.
