# 03: REST notifications go through the Session broadcaster

**What to build:** The REST controllers stop depending on the gateway. Behaviour is unchanged for everyone:

- deactivating a user disconnects every open /control socket of theirs, and nobody else's
- changing a session's settings rebroadcasts its state to /display, /control and /rules
- closing a session tells the players room only
- editing or deleting a bonus award updates every room's bonus totals, and changes nothing on any socket when the session isn't live or the edit is rejected

The bonus-awards controller now runs the bonus-changed Live session write itself and hands its outcome to the broadcaster, so the write is visible where it happens.

See the parent spec: `.scratch/session-broadcaster/spec.md`.

**Blocked by:** 01 (Session broadcaster owns outcome delivery and phase timers)

**Status:** ready-for-agent

- [ ] The Session broadcaster gains `broadcastState(joinCode)`, `notifySessionClosed(joinCode)` (players room only) and `disconnectUser(userId)`, moved from the gateway unchanged in behaviour
- [ ] `broadcastState` sends the same per-room snapshots as an admin action that only rebroadcasts (new test)
- [ ] The users controller calls `disconnectUser`, after deactivating, on the broadcaster
- [ ] The sessions controller calls `broadcastState` after persisting settings and `notifySessionClosed` after evicting the session
- [ ] The bonus-award mutations controller runs the bonus-changed write and passes its outcome to `deliver`; its spec asserts both happen on success and neither happens when the edit is rejected
- [ ] Users, sessions and bonus-awards controller specs use a fake Session broadcaster instead of a fake gateway
- [ ] Disconnect-user, notify-session-closed and bonus-changed specs call the broadcaster, with unchanged assertions
- [ ] No controller imports the gateway
- [ ] Backend suite and `pnpm typecheck` pass
