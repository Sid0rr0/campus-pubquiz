# 03: Reopening the joker pick

**What to build:** Previous from round 0's round intro goes back to the joker pick and reopens it with a fresh minute. Teams that chose keep their choice, and so do teams whose joker the quiz master set; drawn jokers are cleared so those teams get a real chance to choose, and a fresh draw if they still don't. A reopened pick offers only rounds with no opened question, so no team can double a round whose questions it has already seen. Draws (here and everywhere) use the same pickable-rounds rule.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 02

**Status:** done

- [ ] Previous from round 0's `round_intro` → `joker_pick` when Jokers is on; a fresh 60 s deadline is armed
- [ ] Re-entering clears drawn jokers and keeps chosen and quiz-master-set ones
- [ ] The pickable rounds exclude every round with an opened question; `PICK_JOKER` for such a round is refused; draws never return one
- [ ] A team's kept joker on a started round stays, but can only be moved to a pickable round
- [ ] Pure joker module specs (pickable rounds, draw) and real-store harness specs for the reopen path
- [ ] `DOCUMENTATION.md` status table and `/guide` updated
