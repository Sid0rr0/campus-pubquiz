# 02: Opened questions stay opened through Previous and restarts

**What to build:** A question counts as opened from the moment it first opens in a session, for the rest of that session. Today "opened" is worked out from the session's current position, and `furthestOpenIndex` resets with each block. So if the quiz master opens block 2's first question and then presses Previous back into block 1's reveal, that question looks unopened again: it could be deleted along with its answers, or have its type changed. Each session now remembers the questions it has opened. This survives a backend restart, so it's stored with the session, which needs a schema change and migration. It's added to whenever a question opens, through the same Commit a move path every press takes. The live-edit state the editor receives uses this set. See ADR 0002.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Opening a question adds it to the session's opened questions, and the session saves it with its progress.
- [ ] Pressing Previous back across a block start leaves earlier-opened questions opened, and the editor still offers only fix-in-place edits for them.
- [ ] After a backend restart and session restore, the opened questions are the same as before.
- [ ] A session from before this change, with no stored opened questions, falls back to what its position implies.
- [ ] Tests go through the session, not the storage. They cover opening, Previous across a block, and restore.
- [ ] A migration adds the new column, and `pnpm --filter backend db:migrate` applies it cleanly.
