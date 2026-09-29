# 02: Admin game hook on a shared connection core; /control switches over

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** On /control, every rejected admin action reaches the quiz master as its own notice (toast). The red connection banner appears only when the connection is actually lost, refused or reconnecting. A rejected bonus award is never lost, even if a state update arrives while it is in flight. A rejected action on a live session never bounces the quiz master to the session picker.

Build a shared connection core (internal, not used by pages directly). It owns:

- the socket lifecycle and the identity reset on a new session;
- the snapshot;
- the connection error, set only by connection problems;
- the reconnect timestamp;
- an emit-with-acknowledgement helper with a timeout. An emit made while disconnected, or one that times out, resolves to failure with the existing "not connected" message.

On top of the core, build the admin game hook. It returns the snapshot, connection error, reconnect timestamp, live answers (with the REST-fold setter and the focused-question filter), presenter context, and the admin actions:

- send action;
- grade answer;
- kick team;
- award bonus;
- set break end time;
- set display text scale;
- create showdown round.

Each action returns a promise of the acknowledgement result and shows a toast on every rejection by default. /control moves onto this hook. The bonus award and showdown forms await the result and keep what the quiz master typed when it fails.

The old three-room hook stays in place for /remote, /play and /display until tickets 03, 04 and 06.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Failing regression tests are written first, against today's hook and /control, for:
  - a rejected kick landing in the connection banner;
  - a bonus-award rejection misrouted by a state update arriving mid-flight;
  - a rejected action on a live /control session being treated as a connection error
- [ ] The faked socket.io-client transport used by hook tests captures each emit's acknowledgement callback, so a test can answer success or failure, or leave it unanswered to exercise the timeout
- [ ] Admin hook tests cover:
  - each action resolving on success;
  - a rejection producing a toast without touching the connection error;
  - repeat identical rejections each producing a toast;
  - an emit while disconnected failing fast with "not connected";
  - the bonus-award rejection still reaching its caller when a state update arrives while it is in flight;
  - identity reset on a session change
- [ ] /control uses the admin game hook, and its page tests mock the admin hook instead of the three-room hook (no no-op padding defaults)
- [ ] The bonus award and showdown forms keep their values when the action is rejected
- [ ] The Advance rejection (ungraded answers) still shows its reason as a toast
- [ ] An unknown ?code= still bounces /control to the session picker; a rejected action on a live session does not
- [ ] The admin hook exposes no players-only members and no bonus-award-error value
