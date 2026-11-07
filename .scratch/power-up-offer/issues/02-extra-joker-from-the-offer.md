# 02: The extra joker comes from the Power-up offer

**What to build:** The Power-up offer module gains the extra joker. Given the extra joker's offered round (from the existing next-round rule, with its visible title) and the team's joker round, its entry can be bought now only for the next round before its intro. Otherwise it is held back by coins, or it is not available now because that round is the team's joker round or already doubled by an earlier extra joker. The card names the round by its title when the round overview showed it, and as "Round N" otherwise. A buy for any round other than the offered one gets "Only the next round can be doubled, before its intro". The server's purchase path refuses an extra joker with the module's reason, in today's order (not offered → not the next round → already doubled → limit → coins), and stops listing the team's doubled rounds by hand. The phone's extra joker card comes from the module. The existing extra joker refusal rule is folded into the module and no longer exported. The extra joker behaves for teams exactly as before.

Parent spec: `.scratch/power-up-offer/spec.md`

**Blocked by:** 01; `doubled-rounds` 01 (Doubled rounds module): the offer takes a team's already-doubled rounds from that rule instead of listing them itself

**Status:** ready-for-agent

- [ ] Table tests at the module's interface cover every extra joker refusal reason and their order, the joker round and an earlier extra joker each blocking a round, no offered round, the title against "Round N" naming, and a request for a round other than the offered one
- [ ] The server refuses an extra joker buy with the module's reason, the wording is unchanged, and a refused buy stores nothing and changes no balance
- [ ] The purchase change module no longer builds the team's doubled rounds or counts extra joker uses itself
- [ ] The phone's extra joker card and its "Not available now" row come from the module; the power-ups list keeps no rule logic of its own
- [ ] The old extra joker refusal rule is no longer exported; its cases are moved to the module's tests, and the extra joker specs are cut to checking that the rule's result is used correctly
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm mutate:changed` (survivors killed or marked) and `pnpm crap:changed` pass
- [ ] The power-up e2e journeys (`pnpm e2e`) pass once, unchanged
