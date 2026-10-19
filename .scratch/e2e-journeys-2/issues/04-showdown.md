# 04: Showdown

**What to build:** A journey where two teams end tied on the leaderboard and the quiz master plays a showdown: the teams take turns in seat order across their phones and the big screen until the tie is broken.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The tie is set up through play, not the database.
- [x] Showdown turns are snapshotted on every screen and the move is recorded.
- [x] The final placing is asserted by hand.
- [x] Passes `--repeat-each=5`.

Notes: the guesses are entered simultaneously (every phone in the showdown shows "Your turn!"); the seat order is the order the guesses are revealed in, one Advance per team. The final placing is asserted on the podium and on each phone's own standing, because the ended screen is not reachable after a decided showdown (see `16-bug-showdown-end-screen.md`).
