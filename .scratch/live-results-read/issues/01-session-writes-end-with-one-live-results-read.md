# 01: Session writes end with one live results read

**What to build:** Every session write that touches scores (an answer, a grade, a bonus, a roster change, a press, a quiz edit) ends by refreshing the session's **live results** through one new operation: the leaderboard, the verdict tallies and the fun fact data. Users see no change. The leaderboard, the reveal's "N teams correct" and the break's fun facts update at the same moments as today. A failed read still keeps that figure's earlier value until the next write.

The **live results read** is a new collaborator inside the live session module. It takes a session and returns that session with every live result replaced by a fresh read from the Standings module. The three reads run in parallel, each on its own: a read that fails is logged with the figure's name and the session's join code, and that figure keeps the value the given session already holds. The operation never throws because a read failed. It doesn't store the session; the caller does. A comment on it says that adding a live result means adding its read here and nothing else.

The session write uses it in place of its own three parallel reads, its per-figure fallback helper and its chain of field spreads. It still brings the prior standings up to date first. Writes that opt out of the standings read (events that don't touch scores) still skip it.

See the spec's "The live results read" and "Callers → Session write".

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The live results read exists in the live session module with the interface and failure policy above.
- [ ] The session write ends with it when a write touches scores. Its own reads, its fallback helper and its field spreads for the leaderboard, verdict tallies and fun fact data are gone.
- [ ] Writes that don't touch scores still skip the read, and the prior standings rule is unchanged.
- [ ] The existing session write specs pass unchanged in what they assert:
  - a failed standings read after a bonus keeps the earlier leaderboard, and the next change catches it up;
  - overlapping writes end with both changes on the board, whichever read lands last.
- [ ] New gateway case: when only the verdict tally read fails after a grade, the leaderboard and fun fact data still update, and the tallies keep their earlier value.
- [ ] The tests use the existing real-store gateway harness. The live results read has no unit spec of its own.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass.
