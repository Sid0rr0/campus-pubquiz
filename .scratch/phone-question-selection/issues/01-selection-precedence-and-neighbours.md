# 01: A pure module picks the phone's question and its neighbours

**What to build:** A pure phone question selection module returns the question a team's phone shows: the browsed question if it is still in the block, else the question the big screen is revealing, else the block's last opened question, else the current question, else none. It also returns the previous and next opened question within the block (back/forward availability). `/play` calls it in place of the inline `??` chain and the prev/next index arithmetic; the page keeps the browsed id and the handlers that set it. Behaviour on the phone is unchanged.

Parent spec: `.scratch/phone-question-selection/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The module is pure, takes plain data (opened questions, current question, on-screen reveal question id, browsed id) and returns new values without mutating input
- [ ] A table test covers: default follow with and without a current question; display stepped back leaves the phone on the newest; reveal follows the on-screen question; browsed beats reveal; browsed id no longer in the block; neighbours at first, middle, last and with an empty block
- [ ] `/play` reads the selected question and its neighbours from the module; the inline precedence chain and prev/next index arithmetic are deleted from the page
- [ ] Existing `/play` tests (`question-navigator`, `question-visibility`, `break-and-reveal`, `answered-questions`) pass unchanged
- [ ] No change to what the phone shows in any status
