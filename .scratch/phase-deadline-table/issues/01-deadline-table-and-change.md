# 01: Add the phase deadline table and drive the deadline change from it

**What to build:** One phase deadline table lists every **Phase timers** deadline once: its session field and the label its expiry logs under. The table is type-checked to cover exactly the deadline change's keys. Building a session's deadline change and the Session write's "did a write move a deadline?" check both loop over the table, so a write that moves any tabled deadline reports a deadline change and the timers re-arm. A deadline key with no row fails `typecheck`. Nothing users see changes.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] One phase deadline table sits next to the deadline change shape, checked with `satisfies` against a record over exactly its keys (a missing or extra row is a type error)
- [ ] Building the deadline change comes from the table rather than listing fields
- [ ] The Session write's moved-check compares every tabled key; its "moved with nowhere to report it" guard is unchanged
- [ ] New session write spec case: a write that moves only the joker pick deadline reports a deadline change carrying all three current deadlines
- [ ] Every existing phase timer and outcome delivery spec passes unchanged
