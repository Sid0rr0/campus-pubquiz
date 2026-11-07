# 01: Doubled rounds module, used by the extra-joker refusal

**What to build:** One shared rule for which rounds a team doubles in a session: its joker round plus every round it bought an extra joker for, each listed once. The server's extra-joker purchase step reads its "That round is already doubled" input from this rule instead of building the list from the team's purchase rows by hand. Teams see no change: the same purchases are refused for the same reasons.

Parent spec: `.scratch/doubled-rounds/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A new module of its own in shared types (not added to the joker module, so tickets 02–04 don't edit the same file) takes the team's joker round id (or none) and the team's purchases (power-up id and round id, null for question power-ups and blind purchases with no round) and returns the doubled round ids, without duplicates.
- [ ] A session-level helper answers the same for one team from the session's jokers and its purchase list, ready for ticket 03.
- [ ] A Vitest table test covers: no joker and no purchases; joker only; extra joker only; joker and extra joker on different rounds; joker and extra joker on the same round (listed once); several extra jokers; question power-ups ignored; an extra joker with no round ignored.
- [ ] The extra-joker purchase step passes the module's answer as the refusal's doubled rounds; every existing extra-joker refusal spec passes unchanged.
- [ ] `GLOSSARY.md` defines **Doubled round** (a round that counts double for a team: its joker round or a round it bought an extra joker for; never more than double), and the **Joker round** entry's _Avoid_ line points "doubled round" to the new term instead of banning it.
- [ ] `pnpm crap:changed` passes; `pnpm mutate:changed` leaves no survivors in the new module.
