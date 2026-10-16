# 02: A phone resyncs as soon as the player comes back

**What to build:** `/play` calls `forceReconnect` when the page becomes visible after being hidden for at least `HIDDEN_RECONNECT_THRESHOLD_MS` (5 s), on `pageshow` with `event.persisted`, and on the window's `online` event. The rejoin goes through the team link's existing join path, so `previousSocketId` hands the team's seat over. A short hide (under the threshold) does nothing.

Parent spec: `.scratch/reconnect-resilience/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Hidden ≥ 5 s, then visible → `forceReconnect` is called once (fake timers)
- [ ] Hidden < 5 s → no reconnect
- [ ] `pageshow` with `persisted` and `online` each trigger a reconnect
- [ ] Listeners are removed on unmount
- [ ] The rejoin carries `previousSocketId`, and the team keeps its seat (team-link reducer test)
