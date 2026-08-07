## Persistence: Postgres + MikroORM

Process restarts must not lose data. Every submitted answer and score is written to the DB. In-memory state is always rebuildable from it. Key schema:

- `Quiz → Round → Question` (authoring-time)
- `GameSession → Team → Answer` (runtime)
- `Question` has a `type` enum + JSON `payload` column for extensibility (new types without migrations)

Entities live in `apps/backend/src/db/entities/`, one class per table, each extending `BaseEntity` (`apps/backend/src/db/entities/base.entity.ts`) for a shared auto-increment `id` plus `createdAt`/`updatedAt` (via a `TimestampedEntity` mapped superclass). `game_session_teams` is a pure join table with a composite PK and extends `TimestampedEntity` directly, skipping the surrogate `id`. Data access goes through one repository per entity (`apps/backend/src/db/repositories/`) injected into services via `@InjectRepository` — services never touch the `EntityManager` directly except for `persistAndFlush`/`upsert`/`nativeDelete` calls scoped to their own repository. IDs are sequential integers (Postgres `serial`), not UUIDs.

Migrations live in `apps/backend/src/db/migrations/` (one squashed initial migration as of the MikroORM cutover) and run via `pnpm db:migrate` (`mikro-orm migration:up`) locally or `pnpm db:migrate:prod` (`node dist/scripts/migrate.js`) in deploys. Generate a new migration after an entity change with `pnpm db:migrate:create`.

## Backend Import Convention

Backend (`apps/backend`) source and test files import via the `@/*` path alias (mapped to `src/*` in `tsconfig.json`), never relative `./`/`../` paths.
