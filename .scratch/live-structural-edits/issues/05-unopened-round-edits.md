# 05: Add, delete and reorder unopened rounds, and change their break-after and kahoot

**What to build:** While a quiz is live, whole rounds after every live session's current round can be added, deleted and reordered. Their break-after and kahoot setting can also change. A typical case is "we're running long, put a break earlier": turning on break-after for a later round in the current block moves where the current block ends, which only moves the line across questions nobody has opened. The current round and every earlier round keep their place, break-after and kahoot setting, even while only the current round's title card is on screen. The usual round rules still apply (kahoot-allowed question types, the last round always breaks). Rounds are saved by position, so moving a round rewrites rows by position. That's harmless here, because only unopened rounds move and they have no answers or round ratings yet.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Rounds after every live session's current round can be added, deleted and reordered in the editor, and the guard accepts the save.
- [ ] Break-after and kahoot can change on those rounds, including a later round's break-after, which changes where the current block ends.
- [ ] Moving, deleting or changing break-after or kahoot on the current round or an earlier one is refused with a 409, and the editor disables those controls.
- [ ] After a save, the session's breaks follow the edited rounds' break-after (the structure is data, nothing hardcoded), and the round overview shows the edited rounds.
- [ ] Round ratings and feedback for rounds already played are unaffected.
- [ ] Guard spec table cases and editor panel tests cover the above.
- [ ] DOCUMENTATION.md is updated, and so is the `/guide` page if it covers live quiz editing.
