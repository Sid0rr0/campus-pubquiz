# 04: Delete the dead per-round quickfire gates

**What to build:** Now that a quickfire session always plays with power-ups off (ticket 03) and a quiz never mixes modes (ADR 0005), the per-round quickfire gates in the power-up code can't fire. Delete them and the specs that pin them. Teams and the quiz master see no change.

Parent spec: `.scratch/quiz-mode-module/spec.md`

**Blocked by:** 03 (A stale quickfire session restores off); `power-up-offer` 01 and 02 (they move the purchase path's quickfire check into the Power-up offer module and edit the extra joker rules this ticket touches)

**Status:** ready-for-agent

- [ ] The question power-up "no help in a quickfire round" check is gone from the Power-up offer module, along with the quickfire flag the play page passes it for that purpose.
- [ ] The extra joker's next-round rule no longer skips a quickfire round.
- [ ] The live-edit rebuild no longer refunds an extra joker whose round became a quickfire round.
- [ ] The specs that pinned those three gates are deleted; every other purchase, power-up offer and live-edit spec passes unchanged.
- [ ] `pnpm crap:changed` passes.
