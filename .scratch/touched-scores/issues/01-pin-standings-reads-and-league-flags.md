# 01: Pin which events read standings and flag league tables

**What to build:** test-only groundwork. Before the "touched scores" decision moves into the change modules, today's behaviour is pinned event by event: which events re-read the Live results (standings) after their Session write, and which, on an ended session, flag that league tables may have changed. The new cases pass against today's code, so they catch any event whose behaviour shifts in ticket 02.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The session-write gateway spec's "events that do not touch scores" group shows, for each such event, that no standings read runs (through the write gate's standings point or a standings read spy, as the spec already does): round rated, feedback sent, a team's own player count, an admin-set player count, a disconnect, the break end time, the display text size, the display sound mute, a showdown guess, a new showdown round, and a settings and leagues change. Cases already covered are not duplicated
- [ ] The spec's existing groups still show that answers, grades, bonus awards (award, edit, remove), joins, leaves, kicks, presses, timer expiries and quiz edits read standings. A touching event with no case yet gets one
- [ ] The league-tables-changed spec gains a case: an event that doesn't touch scores (for example feedback) on an ended session flags nothing and redraws no other lobby. Its existing cases pass unchanged
- [ ] No source code changes; every new case passes on today's code
