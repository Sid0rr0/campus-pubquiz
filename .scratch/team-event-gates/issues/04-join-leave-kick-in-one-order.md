# 04: Join, leave and kick land in one order

**What to build:** A team that has just reconnected on a new phone can't be dropped by a leave from its old socket. A join and a kick for the same team land in one order, so the team is either kicked or joined, never half of each. Today the leave's seat-ownership check reads the stored session, and the team service's join and roster removal both write to the database before the session write.

Team joined resolves or creates the team inside its session write; the takeover rule is already inside. Team left checks seat ownership and removes the team from the roster inside its write. Kick removes the team from the roster inside its write. The shared team-removed step becomes a private helper that builds the change. The join reply (saved answers, bonus awards, ratings, feedback) is still read after the write.

Parent spec: `.scratch/team-event-gates/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A team rejoins on a new socket (takeover), and a leave from its old socket is held behind it: the leave is refused, and the team stays on the roster and connected.
- [x] A kick and a rejoin of the same team, overlapping in both orders, leave the roster, the connection and the leaderboard agreeing with each other.
- [x] A refused leave stores nothing.
- [x] `join-players.spec.ts`, `team-removed.spec.ts`, `team-presence.spec.ts` and the session-write kick case pass unchanged.
