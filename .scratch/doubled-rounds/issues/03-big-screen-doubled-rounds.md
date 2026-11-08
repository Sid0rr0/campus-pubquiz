# 03: Big screen: joker badges and fun facts use the module

**What to build:** The leaderboard's joker badges on the big screen and the joker fun facts read a team's doubled rounds from ticket 01's session-level helper, so they always agree with the standings. The audience sees the same badges and facts as today.

Parent spec: `.scratch/doubled-rounds/spec.md`

**Blocked by:** 01 (Doubled rounds module)

**Status:** done

- [ ] The leaderboard board badges a team when any of its doubled rounds is a round of the block in play; a team doubling through an extra joker is badged the same as one doubling through its joker.
- [ ] Fun facts' joker holders are built from each roster team's doubled rounds, keeping the "round must exist in the quiz" and "on the roster" filters and the joker's source (chosen / drawn / set by the quiz master / extra) the facts use.
- [ ] Neither file filters the purchase list for extra jokers by hand any more.
- [ ] The existing leaderboard-board and fun-facts tests pass unchanged.
- [ ] `pnpm crap:changed` passes.
