---
name: regen-architecture-docs
description: Regenerate the Mermaid diagrams in docs/architecture.md from the current code, verify they render, and commit.
disable-model-invocation: true
---

# Regenerate Architecture Docs

Regenerate `docs/architecture.md` so its Mermaid diagrams match the code as it is now.

## 1. Read

`CLAUDE.md`, `DOCUMENTATION.md` (System Overview, Statuses, Real-Time Protocol, Persistence), `GLOSSARY.md` and the current `docs/architecture.md`.

## 2. Rebuild the sections

Keep the structure and the 8 sections unless the code no longer supports one:

1. **System context**: browsers (`/display`, `/control` + `/remote`, `/play`, management routes) → Next.js frontend; Socket.IO and REST straight to the NestJS backend; Postgres, media storage, Google Sheets import, Sentry.
2. **Workspaces**: which apps depend on `shared/types`.
3. **Backend modules**: request layer (`GameGateway`, REST controllers) → `game/socket` (`dispatchSocketEvent`, handlers, `deliverOutcome`, `broadcastGameState`, lock timers) → `game/state` (`GameStateService`, `SessionWriteQueue`, `GameSessionStore`, `MoveCommitter`, `BlockGradingService`, `projectScreen`, `GameProgressRepository`) → domain services → repositories → Postgres. Draw edges to the domain-services subgraph, not to each service, so the graph doesn't sprawl. Keep the "Key seams" list below it.
4. **Sequence diagram, answer submit**: from the phone to the per-room `STATE_UPDATED` and the admin-only `ANSWERS_UPDATED`.
5. **Sequence diagram, Advance**: the quiz master presses Advance (or a lock timer fires), through `MoveCommitter` to the broadcast.
6. **Status machine**: `stateDiagram-v2` of the game statuses, grouped as answering / break / revealing, with labelled edges.
7. **Data model**: `erDiagram` of every entity in `apps/backend/src/db/entities/`.
8. **Frontend modules**: routes → hooks (`useDisplayGame`, `useAdminSession`/`useAdminGame`, `useTeamJoin`/`usePlayerGame`) → `useGameConnection` (socket) and `lib/*-api.ts` (REST).

## Rules

- Take everything from the code, not from the old diagrams or the docs. Check imports and call sites (`app.module.ts`, `game.gateway.ts`, `game-state.service.ts`, `commit-a-move.service.ts`, `outcome-delivery.util.ts`, the entities, the frontend `page.tsx` files and the `lib/use-*.ts` hooks). Add modules, entities, events or statuses that have appeared; remove ones that are gone.
- Use the domain terms from `GLOSSARY.md`. Keep the prose short: the diagrams carry the content, and behaviour stays in `DOCUMENTATION.md`.

## 3. Verify

Copy the file to the scratchpad and run:

```sh
npx -y @mermaid-js/mermaid-cli@11 -i arch.md -o out.md -e png
```

Fix any chart that fails. Open the PNGs for the backend-module graph and the status machine, and simplify any graph whose edges sprawl.

## 4. Links and commit

- Keep the existing links to `docs/architecture.md` in `CLAUDE.md` and `DOCUMENTATION.md`, and fix them if the file moves.
- Commit to main as `docs(repo): regenerate architecture diagrams`, with the Co-Authored-By trailer. Stage only the docs you changed.

When done, list what changed in each diagram.
