# 02: Opened questions stay opened through Previous and restarts

**What to build:** A question counts as opened from the moment it first opens in a session, for the rest of that session. Today "opened" is worked out from the session's current position, and `furthestOpenIndex` resets with each block. So if the quiz master opens block 2's first question and then presses Previous back into block 1's reveal, that question looks unopened again: it could be deleted along with its answers, or have its type changed. Each session now remembers the questions it has opened. This survives a backend restart, so it's stored with the session, which needs a schema change and migration. It's added to whenever a question opens, through the same Commit a move path every press takes. The live-edit state the editor receives uses this set. See ADR 0002.

**Blocked by:** 01

**Status:** done

- [x] Opening a question adds it to the session's opened questions, and the session saves it with its progress.
- [x] Pressing Previous back across a block start leaves earlier-opened questions opened, and the editor still offers only fix-in-place edits for them.
- [x] After a backend restart and session restore, the opened questions are the same as before.
- [x] A session from before this change, with no stored opened questions, falls back to what its position implies.
- [x] Tests go through the session, not the storage. They cover opening, Previous across a block, and restore.
- [x] A migration adds the new column, and `pnpm --filter backend db:migrate` applies it cleanly.

## Comments

Implemented in a single commit (see git history for the hash). `SessionState.openedQuestionIds` is added to in `settleSession`, the step every press, create and restore passes through, so it covers Commit a move. It is saved with the progress in the new nullable `game_sessions.opened_question_ids` column (migration `Migration20261006120000_AddOpenedQuestionIdsToGameSessions`, applied with `pnpm --filter backend db:migrate`). A null column restores as empty and settle derives the ids from the restored position. `GameStateService.getOpenedQuestionIds` now reads the stored set, which the editor's live-edit state and the save guard both use. Tests: `opened-questions.spec.ts` (opening, Previous across a block, restart, legacy fallback) and a round trip in `game-progress.repository.spec.ts`. `CONTEXT.md` and `DOCUMENTATION.md` updated.
