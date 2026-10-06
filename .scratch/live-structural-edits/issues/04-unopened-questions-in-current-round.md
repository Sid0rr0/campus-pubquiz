# 04: Change unopened questions in the current round

**What to build:** The line moves into the current round. In a live session's current round, the questions after the last **opened question** can be added, reordered or deleted, or moved to a later round. Teams' phones only get questions up to the furthest opened one, so nobody sees the change until a question opens. Once the current block starts **locking**, and through its **break** and reveal, its rounds are frozen: adding a question then would put the locking countdown on a question that's no longer last, or add an unanswerable question to a locked block. The editor explains this and suggests a later round. A round must always keep at least one question.

**Blocked by:** 03

**Status:** done

- [x] In the current round (status in **answering**, before locking), questions after the last opened one can be added, reordered, deleted, or moved to a later round. Opened questions keep their order and stay at the start of the round.
- [x] Inserting a question before or between opened questions, or moving an opened question, is refused with a 409.
- [x] From locking through the break and reveal, the current block's rounds can't gain, lose or reorder questions. The editor shows why.
- [x] Removing the last question of a round is refused by the existing empty-round validation.
- [x] After a save, the session carries on from the same opened question, and the next press opens the question now placed after it.
- [x] Reconnecting clients (display, admin and players) get a full view that matches the edited round.
- [x] Guard spec table cases and editor panel tests cover the above.

## Comments

Implemented in a single commit (see git history for the hash). `LiveEditFrontier` gained `hasCurrentBlockStartedLocking` (status `locking` or any break/reveal status, or Previous having stepped back before the furthest opened round, whose block may already have locked), merged so it only counts for a session standing on the furthest-on round. `getRoundStructureEditing` turns the frontier into `frozen` / `after-opened` / `free` per round and `getOpenedPrefixLength` finds the opened questions pinned at a round's start; the guard (`findRoundQuestionViolations`) and the editor (`getPinnedQuestionCount`) both read them. In an `after-opened` round the guard keeps the opened prefix's ids and positions (a 409 otherwise, with a message to add after the last opened question) and leaves everything after it free, including moves in from and out to later rounds; a locking round gets the frozen treatment with a message suggesting a later round. The editor pins opened questions (no move, delete or send-to-round), stops the first unopened question moving above them, keeps Add enabled until the block locks, shows a note on pinned/locking rounds, and the outline won't drag or drop among pinned questions. The existing empty-round validation covers removing a round's last question. No session-side change was needed: `quizEdited` already reloads the quiz and keeps progress, so the next press opens whatever now follows the opened question (`live-structural-edit.spec.ts` covers that, the reconnect view and the locking countdown landing on the new last question). Tests: shared `live-edit-frontier.test.ts`, guard spec table cases (current round with an opened prefix, locking, none opened), `opened-questions.spec.ts` for the flag per status, editor panel/outline/draft-state tests. `CONTEXT.md` and `DOCUMENTATION.md` updated; the `/guide` page is untouched (this is the quiz editor, not `/control`).
