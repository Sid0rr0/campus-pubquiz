# 02: Snap back and re-pin move into the selection module

**What to build:** The two state-adjusting rules in `/play` move into the pure selection module. **Snap back:** when the current question changes or the reveal step changes and auto-advance is on, the browsed pick is cleared. **Re-pin:** with auto-advance off, a shown question that isn't the browsed pick becomes the browsed pick (covers turning auto-advance off and a new block replacing the pinned one). `/play` keeps the browsed id and remembers the previous current-question id and reveal step it passes in; the render-time `if` blocks that detect those changes and set the browsed id are replaced by one call to the module. Turning auto-advance on still clears the browsed pick immediately. Behaviour on the phone is unchanged.

Parent spec: `.scratch/phone-question-selection/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The module returns the browsed pick to remember next, in addition to the question to show and its neighbours
- [x] Table test rows cover: snap back on a new current question and on a reveal step, with auto-advance on and off; no snap back when nothing changed; re-pin right after auto-advance is turned off; re-pin when a new block replaces the pinned question; turning auto-advance on clears the pick
- [x] The render-time snap-back block and re-pin block are deleted from `/play`; the page holds only the browsed id, the auto-advance setting and the change-detection values it passes in
- [x] Existing `/play` tests (`auto-advance-setting`, `question-navigator`, `question-visibility`) pass unchanged
- [x] No change to what the phone shows in any status

## Comments

Implemented in the commit titled `feat(frontend): move snap back and re-pin into the phone question selection module` (see git history for the hash). `selectPhoneQuestion` now also takes the auto-advance setting, the reveal step and the previous current-question id / reveal step, and returns the browsed pick to remember next. `/play` keeps the browsed id, the setting and the two previous values, and syncs them after the one call. `browsedQuestionAfterAutoAdvanceChange` covers "turning auto-advance on clears the pick" for the settings handler.
