# 02: Answers, grades and Ask the room readiness move to the team view

**What to build:** A team's answers, grades and Ask the room readiness reach its phones only through the team view. Every write that changed them lists the affected teams instead of building a sync: answer submit (every connected team while Ask the room is offered), grading by hand, live answer-key fixes, the three reveal-entry moments (entering reveal intro, quickfire's collapsed lock-to-reveal, leaving a break into results with Early answer reveal), and team merges. The answers and Ask the room readiness channels are deleted end to end.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The answers and Ask the room readiness outcome fields, emit loops, socket events, payload types, phone listeners, reducer actions and their tests are gone
- [ ] The answer-submit path's own Ask the room readiness loop is gone; readiness comes from the projection
- [ ] `isRevealEntry` still decides when grades become visible, and now feeds changed team ids
- [ ] Live-equals-resync specs: answer submit, grade by hand, live answer-key fix, reveal entry, quickfire collapsed reveal, break exit into results with Early answer reveal, merge
- [ ] Privacy specs: Ask the room readiness is a flag per team, never a count; answers not yet shown to players are redacted in the team view as in the players' room view
- [ ] The answer-received acknowledgement still reaches the sending phone
- [ ] `DOCUMENTATION.md`'s protocol section drops the removed events and names the team view
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
