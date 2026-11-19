# 03: Jokers, sides and doubled rounds move to the team view

**What to build:** A team's joker and side reach its phones only through the team view, and the phone reads its doubled rounds from the team view instead of working them out. Joker pick, the joker draw at pick close, a joker fix by the quiz master, a joker redraw after its round is deleted, side pick, side move by the quiz master and Versus turned off all list the affected teams. The joker and side channels are deleted end to end. The phone's doubled-round and joker extra-points calculations are deleted; only formatting of server-given values remains (ADR 0004: doubling stays derived on the server).

**Blocked by:** 02

**Status:** done

- [ ] The joker and side outcome fields, emit loops, socket events, payload types, phone listeners, reducer actions and their tests are gone
- [ ] The play screen's doubled rounds and joker marks come from the team view; the phone no longer calls the shared doubled-rounds rule
- [ ] The joker save acknowledgement still reaches the picking phone
- [ ] Live-equals-resync specs: joker pick, draw at pick close, joker fix, side pick, side move, Versus off
- [ ] Play screen tests render doubled rounds (joker round and extra joker) from the team view
- [ ] `DOCUMENTATION.md`'s protocol section drops the removed events
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
