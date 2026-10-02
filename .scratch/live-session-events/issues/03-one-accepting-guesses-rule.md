# 03: One "accepting guesses" rule for the showdown

**What to build:** "The showdown accepts guesses" becomes one named rule: the round is active, it is the one named, it is unresolved, and the showdown reveal is at step 0. The rule lives in shared types, next to the phone screen logic. The phone screen's choice between showdown_guessing and showdown_reveal uses it, and so does the Live session module's guard. Two things become module events:

- **A showdown guess.** The module checks that guesses are accepted, then that the socket owns the seat, then that the team takes part in the showdown, then stores the guess.
- **Showdown round creation.** The module re-derives the teams tied for first and creates the round.

Both handlers become one-line adapters.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] An agreement test walks a showdown through its reveal steps. At every step the phone screen is showdown_guessing exactly when a guess from a team taking part is accepted.
- [ ] Guesses after the reveal starts, for a stale round or for a resolved round are refused with "This showdown round is no longer accepting guesses".
- [ ] A guess for another team's seat, or from a team not in the showdown, is refused with today's messages.
- [ ] Creating a round without a tie for first is refused with "No tie for first place to break".
