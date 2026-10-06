# 01: Rename "locked" to "opened" in the live-edit path

**What to build:** A prefactor with no change in behaviour. The live-edit path calls already-shown questions "locked", which clashes with **Locked** in `CONTEXT.md` (no longer accepting answers). Rename it to **Opened question** throughout: in the quiz draft's live-edit state the editor receives, in the quiz controller and live-edit guard, in the game state service's "shown or in progress" query, and in the editor's props. This makes the later tickets easy. Decision record: `docs/adr/0002-live-structural-edits-after-opened-prefix.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The live-edit state the editor receives names the field `openedQuestionIds`, and no `lockedQuestionIds` is left in backend, frontend or shared types.
- [x] The game state service's query for a session's already-shown questions is named for opened questions.
- [x] Guard messages and editor hints say "opened", not "locked" or "shown".
- [x] The live-edit guard spec, quiz controller spec and quiz editor panel tests pass unchanged apart from the renames.
- [x] DOCUMENTATION.md's "Editing a live quiz" section uses "opened question".

## Comments

Done in the commit `refactor(backend,frontend,shared-types): rename locked to opened in the live-edit path` (hash in git history).
