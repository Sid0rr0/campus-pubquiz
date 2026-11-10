# 02: Phone asks the Clue answer module whether an answer is frozen

**What to build:** The phone's question browser stops keeping its own copy of the Clue freeze rule and asks the Clue answer module instead, so the phone shows an answer as frozen exactly when the server would refuse a change to it. A team sees the same frozen card and the same "a new clue will lock this in" warning as today.

- The module gains **freeze state:** given the question, the team's current answer (value and recorded clue, either possibly absent) and the highest clue shown, it returns whether the answer is frozen now and whether a later clue can still freeze it (a clue is left to show). A blank or "I don't know" is never frozen.
- The question browser's own freeze helper goes; it calls freeze state and renders the same frozen card and warning.
- The phone recognises a Clue question by its type through the Question kind registry (`hasClues`), not by checking that `highestClue` and `clueCount` are present.

No `/guide` or docs text: behaviour is unchanged.

**Blocked by:** 01 (Clue answer module owns record/freeze and worth on the server).

**Status:** ready-for-agent

- [ ] Pure tests for freeze state: not frozen before a new clue; frozen after one; never frozen for a blank or "I don't know"; can't freeze on the last clue; a type without clues is never frozen or freezable
- [ ] A parity test over a small table of cases: freeze state reports frozen exactly when clue to record returns "frozen" for a changed, non-blank value
- [ ] The question browser has no freeze logic of its own and no longer infers the question type from optional fields
- [ ] The existing phone question browser and clue-list tests pass unchanged in what they assert (fixtures may gain `type: 'clues'`)
- [ ] `pnpm typecheck`, the frontend and `shared/types` tests, and `pnpm crap:changed` pass
