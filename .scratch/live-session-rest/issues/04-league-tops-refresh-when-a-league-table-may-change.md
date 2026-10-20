# 04: League tops refresh when a league table may have changed

**What to build:** When a session ends, the big screen lobby of every other live session in one of its leagues shows the updated **league top** straight away. The same happens when a session is un-ended with Previous, and when its scores change after it ended (a grade, a bonus award change, a showdown result). It doesn't matter whether the session ended through the control panel or a phase timer. Lobbies whose league top didn't change receive nothing. The session that ended keeps its end screen exactly as today.

The session outcome gets a "league tables changed" flag. Only the Session write's commit step sets it, from a before/after comparison of the stored session, the same way it fills the deadline change. No event sets it by hand. It is set when:

- the status enters or leaves `ended`, or
- the status was `ended` before and after the write and the write refreshed standings.

The held write the Live edit uses goes through the same commit, so a live edit that regrades an ended session sets it too.

When the flag is set, the delivery step runs the existing league top refresh over every other live session after delivering the outcome to its own session, then broadcasts state to each session whose league top changed. It reuses what ticket 01 moved into the REST entry's "refresh league lobbies", which can now sit in the broadcaster and be shared. The per-session rules stay as they are:

- a failed league read leaves that session's league top as it was and is logged
- a session closed meanwhile is skipped
- the refresh never fails the delivery of the outcome that set it off

Glossary in the same change:

- **Live results**: the league top is read at placement, on league changes, and when another session's league table may have changed (it ended, was un-ended, or its scores changed after it ended).
- **Session write**: mention the league-tables-changed flag alongside the deadline change it mirrors.

See the spec's "League tops refresh when a league table may have changed".

**Blocked by:** 01 (REST entry to the Live session module), 03 (The phone's bonus list syncs live: both change the session outcome's shape and the delivery step)

**Status:** ready-for-agent

- [ ] Real-store harness, two sessions in one league: ending the first through the admin action redraws the second's lobby with the new league top
- [ ] Previous from `ended` redraws it again
- [ ] A bonus edit on the ended session (through the REST entry) redraws it
- [ ] A grade or bonus change on a session that isn't ended sends the second session nothing
- [ ] An end driven by a phase timer behaves like the admin action
- [ ] A session in a different league, or whose league top didn't change, gets no broadcast
- [ ] A failing league read for the other session leaves its league top unchanged and the first session's outcome is still delivered
- [ ] No event sets the flag by hand; only the commit step does
- [ ] `GLOSSARY.md` (Live results, Session write) updated
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass
