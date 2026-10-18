# 01: Re-type stored audio and YouTube questions

**What to build:** A MikroORM migration that re-types every stored `audio`/`youtube` question, so that no row in the database uses either type before the types are removed in 02. The app still accepts both types after this ticket. Only the stored data changes.

- `multiple_choice` when `payload.options` is a JSON array with at least one non-blank entry.
- `free_text` otherwise, with the `options` key removed from the payload.
- Every other payload field (media URLs, clip and reveal-clip bounds, `isVideoHidden`) is kept.
- Every row is migrated, including questions from ended sessions. `down()` is a no-op, with a comment explaining why, as in `Migration20261001120000_RetypePictureQuestions`.

See the spec's "Data migration" decision.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A Postgres integration spec, modelled on `apps/backend/src/db/__tests__/answer-verdict-backfill.spec.ts`, migrates up to the previous migration, inserts raw rows, migrates up, and asserts:
  - audio with no options → `free_text`;
  - youtube with `options: []` → `free_text`, with no `options` key;
  - youtube with options `["", "  "]` → `free_text`;
  - audio with options `["Queen","Abba"]` → `multiple_choice`, with options unchanged;
  - a `number` row and a `free_text` row → untouched;
  - `mediaUrl`, `answerMediaUrl`, `mediaStartSeconds`/`mediaEndSeconds`, `revealStartSeconds`/`revealEndSeconds` and `isVideoHidden` survive;
  - an answer on a migrated question keeps its `points_awarded`, `verdict` and `graded_at`.
- [ ] The spec fails before the migration exists and passes after it.
- [ ] `pnpm --filter backend db:migrate` applies it cleanly to the local dev database.
- [ ] `pnpm typecheck` and `pnpm --filter backend test` pass.
