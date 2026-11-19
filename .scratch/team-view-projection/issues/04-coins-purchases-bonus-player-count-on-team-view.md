# 04: Coins, purchases, bonus awards and player count move to the team view

**What to build:** A team's coins, purchases, bonus awards and player count reach its phones only through the team view. Leaving the lobby, a lobby settings change, a power-up purchase, a bonus award edit or delete, and a player count change all list the affected teams. The coins, purchases, bonus award and player count channels are deleted end to end. The bonus-awarded and coin-awarded toasts and the player count save acknowledgement keep their own events, sent alongside the team view.

**Blocked by:** 03

**Status:** done

- [ ] The coins, purchases, bonus award and player count outcome fields, emit loops, socket events, payload types, phone listeners, reducer actions and their tests are gone; a session outcome has no per-team sync fields left
- [ ] Toasts and the player count acknowledgement still arrive, and a team view arriving fires no toast by itself
- [ ] Live-equals-resync specs: leaving the lobby, lobby settings change, purchase, bonus award edit, bonus award delete (with its coin)
- [ ] `DOCUMENTATION.md`'s protocol section drops the removed events
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
