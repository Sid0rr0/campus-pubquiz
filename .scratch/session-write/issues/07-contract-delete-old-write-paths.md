# 07: Contract: standings only from the session write; delete the old write paths

**What to build:** The session write becomes the only place standings are read for a live session, and the only way to change one. The grading refresh no longer fetches standings and its result loses its leaderboard field. Inside Commit a move, the grading stages, the showdown resolve and turning the leaderboard on stop fetching standings, because the press's session write reads them last. The helper that writes one field directly is deleted, along with the comments that warned against a read-modify-write across an `await`.

Restore and session creation get their standings the same way: placing a session at its starting point ends with the standings read before the session is first stored. A session restored after a backend restart, in any status, therefore has its leaderboard in the first snapshot a reconnecting client receives.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 02, 03, 04, 05, 06

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a session restored outside the break with scored answers has a non-empty leaderboard in its first snapshot.
- [ ] A restored session in the break has its ungraded set and its leaderboard in its first snapshot.
- [ ] Turning the leaderboard on shows every joined team, zero-point teams included. The showdown winner's bonus is on the leaderboard as soon as the final reveal step lands.
- [ ] Nothing in the Live session module, the block grading module or Commit a move calls the Standings service except the session write's last step and placing a session at its starting point.
- [ ] The session store is written only by the session write and by session creation and restore.
- [ ] Every existing spec passes, apart from mechanical updates where a test reads the grading refresh result's leaderboard.
- [ ] `CONTEXT.md` gains **Session write** (every change to a live session: one at a time per session, ending with fresh standings). **Grading refresh** drops "and fetches fresh standings". `DOCUMENTATION.md` says events for one session are applied one at a time.
