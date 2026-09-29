# 06: Display game hook; delete the three-room hook and the legacy "exception" emit

Parent spec: `.scratch/role-socket-hooks/spec.md`

**What to build:** The big screen gets its own display game hook on the shared connection core, returning only the snapshot and the connection error. It connects, reconnects, and bounces to the session picker on an invalid code exactly as today.

With /display, /control, /remote and /play all on role hooks, the old three-room socket hook and its result type are deleted, along with its pending-action flags and the unused bonus-award-error value. The gateway stops emitting the legacy untagged "exception" to the sender for events it acknowledges. Handshake-time rejections keep their existing path.

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] /display uses the display game hook, and its page tests mock it; the display hook exposes only the snapshot and the connection error
- [ ] The three-room socket hook, its result type and any tests of it are gone; remaining hook tests target the role hooks
- [ ] Nothing in the frontend imports the deleted hook
- [ ] An acknowledged rejection no longer produces an "exception" event to the sender, and gateway tests assert this
- [ ] An unknown session code and an invalid or expired admin session are still rejected at handshake, and all three pages still bounce to the session picker
- [ ] The full frontend and backend test suites, lint and build pass
