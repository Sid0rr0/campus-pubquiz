# 08: Ask the room

**What to build:** on a multiple-choice question, the percentage split of the other teams' current answers at the moment of purchase.

- Can be bought only once ≥3 other teams have a current answer. Until then it's greyed out with "Waiting for more answers".
- The split is stored with the purchase. No team count, no right/wrong, no names.
- Options removed by this team's 50/50 show crossed out with their share.
- Default cost 2, limit 1.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 04

**Status:** done

Note: the "greyed out with Waiting for more answers" state is not drawn on the phone (it never learns how many teams answered; no team count is exposed). The button stays enabled and the server refuses with "Waiting for more answers", charging nothing.

- [x] Split rule in shared types with unit tests
- [x] Real-Postgres spec: threshold, the team's own answer excluded, stored split survives reconnect
- [x] Phone display, Vitest
