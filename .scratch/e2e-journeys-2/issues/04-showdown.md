# 04: Showdown

**What to build:** A journey where two teams end tied on the leaderboard and the quiz master plays a showdown: the teams take turns in seat order across their phones and the big screen until the tie is broken.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The tie is set up through play, not the database.
- [ ] Showdown turns are snapshotted on every screen and the move is recorded.
- [ ] The final placing is asserted by hand.
- [ ] Passes `--repeat-each=5`.
