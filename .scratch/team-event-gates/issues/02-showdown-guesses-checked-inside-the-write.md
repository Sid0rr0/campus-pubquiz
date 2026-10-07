# 02: Showdown guesses and new showdown rounds are checked inside the write

**What to build:** A team's showdown guess sent just as the quiz master starts the reveal is either part of the round, so the resolve counts it, or refused with "This showdown round is no longer accepting guesses". The reveal never changes under the big screen. Today the "still taking guesses" check and the seat-ownership check read the stored session, and the guess is stored before the session write.

Submit showdown guess runs the "still taking guesses" check and seat ownership, then stores the guess, inside its session write. Creating a showdown round checks for the tie against the leaderboard of the session the write holds, then creates the round, inside its write, so a round is only created for teams still tied.

Parent spec: `.scratch/team-event-gates/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A guess sent while the first reveal step is held on its save is refused, and the resolve doesn't count it.
- [x] A guess sent first and held on its store, then the reveal pressed: the guess is counted by the resolve.
- [x] A refused guess stores nothing; a team's earlier guess, if any, stands.
- [x] Creating a showdown round still refuses when there's no tie for first, with the check made inside the write.
- [x] `showdown-reveal.spec.ts` and `showdown-socket.spec.ts` pass unchanged.
