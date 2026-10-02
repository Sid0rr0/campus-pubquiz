# 06: The remaining events go through the session write, declared as not touching scores

**What to build:** Every other change to a live session goes through the session write too, so nothing can be overwritten by a write running at the same time. These are disconnecting, setting the break end time, setting the display text size, a new showdown round (including sudden death), a showdown guess, lobby settings and closing the session. They don't change scores, so each is declared as skipping the standings read. Closing the session goes through the queue, so a write still in progress can't bring a closed session back. A write queued behind the close fails with the existing "unknown session" error.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a team disconnecting while a bonus write is held shows as disconnected once both finish.
- [ ] A showdown guess submitted while another write is held is in the final snapshot.
- [ ] A lobby settings change made while a join is held keeps both the new settings and the joined team.
- [ ] Closing an ended session while a write is held: the session stays closed, and the held write reports the unknown-session error rather than storing it.
- [ ] None of these events reads standings, and the leaderboard they leave is the one already stored.
- [ ] The disconnect, break-end-time, display-text-scale, showdown, update-session-settings and session-lifecycle specs pass unchanged.
