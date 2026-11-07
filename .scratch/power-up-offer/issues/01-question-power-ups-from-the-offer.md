# 01: Question power-ups come from the Power-up offer

**What to build:** Build the Power-up offer module in `shared/types` for the question power-ups (50/50, first letter, letter count, pin one, wider margin, Ask the room). Given the session's power-up settings, the team's own purchases, its coin balance, the question a purchase is for (or none), and whether Ask the room is ready on it, the module returns one entry per offered power-up. Each entry carries the cost, the limit, the team's uses, and one of three outcomes: can be bought now (for this question); held back only by coins or Ask the room's readiness (with its reason); or not available now (with its reason). It also answers why one exact buy, for a requested question id, is refused. The server's purchase path refuses a question power-up with that reason, worded and ordered as today, and stops counting uses, checking the one use per question and checking for a quickfire round itself. The phone's power-ups list renders the module's entries for question power-ups, and the play page passes the answering question with its quickfire flag instead of deciding the quickfire case. The existing question refusal rule is folded into the module and no longer exported. The extra joker keeps its current path until ticket 02. A team sees the same shop as before, except that a team short of coins and also waiting on Ask the room now sees "Not enough coins".

Parent spec: `.scratch/power-up-offer/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Table tests at the module's interface in `shared/types` cover every question power-up refusal reason and their order, the coins and waiting outcomes, a quickfire round, a session with nothing offered, limits counting only that power-up's uses, one use per question, and a request for a question other than the one offered
- [ ] The server refuses a question power-up buy with the module's reason, the refusal wording is unchanged, and a refused buy stores nothing and changes no balance
- [ ] The purchase change module no longer counts uses, checks one use per question or checks for a quickfire round for question power-ups
- [ ] The phone's question power-up cards, disabled buttons ("Not enough coins", "Waiting for more answers") and "Not available now" rows come from the module; the play page no longer works out the quickfire case
- [ ] The old question refusal rule is no longer exported; its cases are moved to the module's tests, and the backend and phone specs that only repeated them are cut to checking that the rule's result is used correctly
- [ ] A new database-backed spec: two phones of one team race for the last use of a power-up, and only one buy goes through
- [ ] `GLOSSARY.md` has a **Power-up offer** entry, linked from **Power-up**
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm mutate:changed` (survivors killed or marked) and `pnpm crap:changed` pass
