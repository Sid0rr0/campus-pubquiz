# 01: Rename kahoot to quickfire everywhere

**What to build:** A pure rename, no behaviour change: every "kahoot" in code, file names, DB columns, payload fields, copy and docs becomes "quickfire", so the later tickets build on the new name.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** none

**Status:** ready-for-agent

- [ ] Identifiers and files renamed across `shared/types`, backend, frontend, e2e and `scripts/` (`kahoot-visibility.ts`, `KAHOOT_ALLOWED_TYPES`, `kahootQuestionTimerSeconds`, `kahootQuestionEndsAt`, `revealedKahootQuestionIds`, the `kahoot-*.spec.ts` files, `e2e/fixtures/kahoot-round.csv`, …). The per-round `kahootMode` becomes `quickfire` for now; ticket 02 moves it to the quiz.
- [ ] A migration renames `rounds.kahoot_mode` and `game_sessions.revealed_kahoot_question_ids`; the stored `kahootQuestionTimerSeconds` session setting key is migrated in its JSON too, if settings are stored as JSON.
- [ ] User-facing copy says "quickfire" (`/how-to-play`, `/guide`, editor, stats page "Kahoot round" line, night brief).
- [ ] `DOCUMENTATION.md`, `PRODUCT.md`, `CODING_STANDARDS.md`, `README.md`, `docs/architecture.md` renamed; ADR 0001 renamed to `0001-free-text-excluded-from-quickfire.md` with its wording updated.
- [ ] `rg -uu -i kahoot` outside `node_modules`, build output, `.scratch/`, old migrations and `.claude/tdd/` history finds nothing.
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm e2e` pass.
