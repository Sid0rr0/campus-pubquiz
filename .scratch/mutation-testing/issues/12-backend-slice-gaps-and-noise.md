# 12: Backend DB-free slice: files only the DB specs reach, and error-class noise

Status: ready-for-agent

Blocked by: None

**Type:** task

These files count as DB-free by their imports, but only DB-backed specs reach them, so all their mutants are "no coverage":

`game/state/screen-preview.util.ts` (83), `joker-changes.ts` (80), `team-roster-changes.ts` (33), `showdowns-changes.ts` (32), `commit-a-move.service.ts` (23), `team-feedback-changes.ts` (23), `team-player-count-changes.ts` (22), `session-outcome.ts` (23), `session-updates.util.ts` (18), `answers-changes.ts` (16), `bonus-awards-changes.ts` (14), `game/socket/outcome-delivery.util.ts` (38), `auth/session-cookie.ts` (15 no coverage + 6 survived).

Options:

- **(a)** Give them DB-free unit specs. They're pure, so that's possible, and the run would then measure them.
- **(b)** Make the backend Stryker run include the DB-backed specs (one shared testcontainer, a database per worker). This is option (b) from the setup discussion, which was turned down for speed.
- **(c)** Leave them as they are and drop them from `mutate` in `apps/backend/stryker.files.cjs`, so the report only shows code the slice can test.

`auth/session-cookie.ts` (the cookie header parser) deserves a direct spec whichever option is picked.

Separately, the `game/state/errors/*.error.ts` classes each contribute 1–2 surviving message or `name` strings. Decide whether to assert them or exclude `errors/` from `mutate`.

## Decisions (2026-10-23)

- **Option (c)**, applied by a rule that maintains itself: in `apps/backend/stryker.files.cjs`, `dbFreeSources()` keeps a source file only if at least one spec from `dbFreeSpecs()` imports it directly (`@/…` path). The real-store specs are the intended test level for `game/state` (`.scratch/real-store-harness-module`), so unit specs would duplicate them, and including the DB specs was turned down for speed.
- Leave `game/state/errors/` out of `mutate` (add it to `NOT_MUTATED`).
- Give `auth/session-cookie.ts` (`extractSessionCookie`, a request header parser) a direct DB-free spec, so it stays in the mutated set under the new rule.
- Update the README "Running mutation tests" backend bullet to describe the new rule, in the same commit.
- Done when a full `pnpm --filter backend mutate` lists no `game/state/*-changes.ts` or `errors/` files, and `auth/session-cookie.ts` shows no surviving or "no coverage" mutants apart from disabled ones.
