# 03: Move the other 20 events onto declared changes

**What to build:** Every remaining socket event whose game state method only passed a call through now names its change in its declaration, and those methods are deleted. Team events: submit answer, rate round, rate session, send feedback, set player count, pick joker, pick side, buy power-up, submit showdown guess, leave session. Admin events: grade answer, award bonus, kick team, set team joker, set team side, set team player count, create showdown round, set break end time, set display text scale, set display sound muted. Each handler body becomes one dispatch call. Join, disconnect, the timer's auto-lock, the REST-called writes and every read stay on the game state class. Nothing changes for quiz masters or teams.

**Blocked by:** 02

**Status:** done

- [ ] All 20 declarations name their change; all 20 game state methods are gone
- [ ] Every gateway handler except join's is one dispatch call with no inline function
- [ ] The game state class holds only join, disconnect, advance on expiry, the REST-called writes and the reads
- [ ] Every existing gateway spec passes without changing its expectations
- [ ] `DOCUMENTATION.md` says a socket event's declaration names its change; no protocol change
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
- [ ] `pnpm --filter backend mutate:db` for the dispatch step and the change-module provider runs; survivors reviewed
