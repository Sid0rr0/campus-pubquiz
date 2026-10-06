# 05: Add, delete and reorder unopened rounds, and change their break-after and kahoot

**What to build:** While a quiz is live, whole rounds after every live session's current round can be added, deleted and reordered. Their break-after and kahoot setting can also change. A typical case is "we're running long, put a break earlier": turning on break-after for a later round in the current block moves where the current block ends, which only moves the line across questions nobody has opened. The current round and every earlier round keep their place, break-after and kahoot setting, even while only the current round's title card is on screen. The usual round rules still apply (kahoot-allowed question types, the last round always breaks). Rounds are saved by position, so moving a round rewrites rows by position. That's harmless here, because only unopened rounds move and they have no answers or round ratings yet.

**Blocked by:** 03

**Status:** done

- [x] Rounds after every live session's current round can be added, deleted and reordered in the editor, and the guard accepts the save.
- [x] Break-after and kahoot can change on those rounds, including a later round's break-after, which changes where the current block ends.
- [x] Moving, deleting or changing break-after or kahoot on the current round or an earlier one is refused with a 409, and the editor disables those controls.
- [x] After a save, the session's breaks follow the edited rounds' break-after (the structure is data, nothing hardcoded), and the round overview shows the edited rounds.
- [x] Round ratings and feedback for rounds already played are unaffected.
- [x] Guard spec table cases and editor panel tests cover the above.
- [x] DOCUMENTATION.md is updated, and so is the `/guide` page if it covers live quiz editing.

## Comments

Implemented in a single commit (see git history for the hash). `isRoundReached` (`shared/types/src/live-edit-frontier.ts`) says a round is the current round or an earlier one; the guard and the editor both read it. `findLiveEditViolations` now only requires the reached rounds to survive (a `409` for removing one) and checks their `breakAfter`/`kahootMode` in `findBlockShapeViolations`; rounds after the current round are unchecked at round level, while the existing question rules still apply to the reached ones. A reached round that becomes the last one because every later round was deleted is not a break-after change: the last round is forced to break at save, and the quiz ends there. The editor disables move, delete, break-after and kahoot on reached rounds (and move-up into one), keeps Add round enabled, and the outline won't drag a reached round or drop one onto it. No session-side change was needed: `quizEdited` reloads the quiz, so breaks follow the saved rounds; `live-structural-edit.spec.ts` covers a later round's break-after moving where the current block locks. Tests: guard spec table cases over the frontier, shared `isRoundReached` tests, editor panel and outline tests. `CONTEXT.md` and `DOCUMENTATION.md` updated; the `/guide` page is untouched (it covers `/control`, not the quiz editor).
