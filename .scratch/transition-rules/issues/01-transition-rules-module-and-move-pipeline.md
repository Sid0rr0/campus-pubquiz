# 01: Transition rules module, read by the move pipeline

**What to build:** One pure **transition rules** module answers "what does this move set off?". Given the session before a move, the progress after it, and the press (the timer's auto-lock arrives as Advance), it returns a plain record of named **transition facts**: joker pick closes, joker pick reopens, leaves the lobby, start needs every side, leaving the break needs the block graded, quickfire question is speed-scored, block is graded, grades become visible, leaves the break into results, league tables may change. It is built from the shared status-group predicates, which stay unchanged (ADR 0006).

The move pipeline works out the facts once per move and uses them to decide the joker pick crossing, carried coins, the Versus start refusal and when every team is listed as changed (grades become visible, leaves the lobby). The session outcome's reveal-entry check is deleted. The pipeline's order stays the same, with the checks first, so a refused move writes nothing. No behaviour change. See the spec's "The transition rules module" and "Who reads the facts".

**Blocked by:** None within this spec. The spec as a whole waits on team-view-projection, whose changed-team-ids contract this ticket uses.

**Status:** done

- [ ] The transition rules module returns all nine facts and does no database reads or writes
- [ ] Table test without a database: every from × to status pair the state machine allows, for each press, with quickfire, Early answer reveal and Versus each on and off, asserts the full fact record
- [ ] Edge cases are pinned: Previous and End quiz out of a break don't need the block graded; End quiz in the lobby doesn't need sides; only the three reveal moments make grades visible
- [ ] The move pipeline reads joker pick closes and reopens, leaves the lobby, start needs every side, and grades become visible from the facts; the reveal-entry check is gone
- [ ] Existing socket specs pass without changing their expectations: joker draw at pick close, reopen clears draws, carried coins, Versus start refusal, grades reaching phones at all three moments
- [ ] `GLOSSARY.md` gains **Transition fact**
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
