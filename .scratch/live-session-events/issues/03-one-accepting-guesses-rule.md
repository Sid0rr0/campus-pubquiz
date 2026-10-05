# 03: One "accepting guesses" rule for the showdown

**What to build:** "The showdown accepts guesses" becomes one named rule: the round is active, it is the one named, it is unresolved, and the showdown reveal is at step 0. The rule lives in shared types, next to the phone screen logic. The phone screen's choice between showdown_guessing and showdown_reveal uses it, and so does the Live session module's guard. Two things become module events:

- **A showdown guess.** The module checks that guesses are accepted, then that the socket owns the seat, then that the team takes part in the showdown, then stores the guess.
- **Showdown round creation.** The module re-derives the teams tied for first and creates the round.

Both handlers become one-line adapters.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** done

- [x] An agreement test walks a showdown through its reveal steps. At every step the phone screen is showdown_guessing exactly when a guess from a team taking part is accepted.
- [x] Guesses after the reveal starts, for a stale round or for a resolved round are refused with "This showdown round is no longer accepting guesses".
- [x] A guess for another team's seat, or from a team not in the showdown, is refused with today's messages.
- [x] Creating a round without a tie for first is refused with "No tie for first place to break".

## Comments

Implemented in the commit `refactor(backend): showdown guess and round creation are Live session module events` (find it in git history; no hash recorded here).

- `isShowdownAcceptingGuesses(activeRound, roundId, revealStep)` lives in `shared/types/src/on-air-screen.ts`. The phone screen's showdown_guessing / showdown_reveal choice and `GameStateService.submitShowdownGuess` both call it.
- The phone screen needed one more server-only fact, `isShowdownResolved` (like `isAnswerable`), because a resolved round stepped back to reveal step 0 used to show the guess form while the server refused guesses. That was a real disagreement; it is gone now. The players view payload is unchanged.
- `submitShowdownGuess(joinCode, payload, socketId)` checks guesses are accepted, then the seat, then participation, stores the guess and records it. `createShowdownRound(joinCode, payload)` re-derives the tie for first and creates the round. Both refuse with `SessionRefusal`; an `InvalidShowdownError` becomes one too. The two handlers are one-line adapters.
- Tests: the agreement walk and the stale-round, guard-order and exact-message tests are in `showdown-socket.spec.ts`. `session-write.spec.ts`'s "no standings read" test now drives the gateway instead of the removed `showdownRoundCreated`.
- `getActiveShowdownRound` and `getShowdownRevealStep` are no longer used by any handler; they stay until ticket 08 removes the getters.
