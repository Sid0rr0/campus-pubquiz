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

- `pnpm dev` — all workspaces in parallel, output also in `.logs/dev.log` (read it to debug the running servers); `pnpm dev:backend` / `pnpm dev:frontend` for just one
- `pnpm build` / `pnpm lint` / `pnpm typecheck` / `pnpm test` — run across all workspaces; the pre-commit hook and CI both run `typecheck`
- Backend (`apps/backend`) uses **Jest**: `pnpm --filter backend test <path>` to run a single spec, not the whole suite
- Frontend (`apps/frontend`) uses **Vitest**: `pnpm --filter frontend test <filename>` to run a single spec (a filename substring: a path through `[id]` matches nothing)
- `pnpm e2e` — Playwright journeys (`e2e/` workspace) against production builds on :8889/:3001 and the throwaway `campus_pubquiz_e2e` database; needs the docker-compose Postgres running (`docker compose up -d postgres`). Never touches the dev servers, `.next` or `campus_pubquiz`. Local only: not part of `pnpm test`, the pre-commit hook or CI. See README "Running E2E". `E2E_SKIP_BUILD=1` reuses the last builds; `pnpm e2e --repeat-each=5` checks a journey for flakiness; `pnpm e2e:ui` opens Playwright UI mode
- `pnpm --filter backend db:migrate` applies pending MikroORM migrations locally (Postgres must be running — see `docker-compose.yml`); `db:migrate:create` generates one after an entity change

## Constraints

- **Code follows [`CODING_STANDARDS.md`](CODING_STANDARDS.md).** Read it before writing or reviewing code: server-owned game state, the reconnect path, the question type registry, boundary validation.
- **Hosting:** both apps deploy together with Postgres. **Do not deploy the backend to Vercel** — serverless and Socket.IO are incompatible. One backend instance only: no horizontal scaling, no Redis adapter; at pub-quiz scale that's intentional.

## Known Tradeoffs (Accepted)

- **Internet dependency at venue** — deliberate. Phones-on-mobile-data is the UX win; a phone hotspot can carry the two PCs if Wi-Fi dies.
- **Single backend instance** — redeploy drops all sockets (~10s freeze, no data loss). Reconnect/resync path must be built and tested early.
- **JSON payload column** — flexible for new question types; requires per-type Zod validation at import time or crashes will happen live on stage.
- **Last-write-wins answers** — teams can revise until the block locks. This is the desired pub-quiz behavior.
- **localStorage tokens** — private browsing or cleared storage loses team identity (admin/moderator session cookies have the same weakness). The escape hatch is the team code: the admin removes the team, then the phone rejoins with its team name and code.
- **Live answer-key fixes overwrite manual overrides** — correcting a shown auto-graded question's answer/points/margin during a live session re-scores every answer to it, discarding any per-answer override (e.g. adjusted `match` partial credit, a `number` answer the moderator marked correct outside the margin, or points given to a team that wasn't closest on a `closest_guess`); the admin re-overrides in break if needed. The typed-answer type (`free_text`) is the exception: the moderator's grade on a non-matching answer survives a key fix. "Graded automatically" is inferred by re-running the submit-time grade against the pre-edit key, so a moderator grade identical to that automatic grade (e.g. confirming a match) is cleared by a later key fix that no longer matches it.
- **Team merges aren't recorded or reversible** — merging two teams keeps nothing about who merged, when, or the old name, and can't be undone; staff check the confirm step before pressing Merge.
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
- Scopes, with the folder each names: `shared-types` (`shared/types/src`), `backend` (`apps/backend/src`), `frontend` (`apps/frontend/app`: no `src/` or `components/`), `e2e` (`e2e/tests`, `e2e/support`), `repo` (root-level/tooling changes not scoped to one workspace)

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
