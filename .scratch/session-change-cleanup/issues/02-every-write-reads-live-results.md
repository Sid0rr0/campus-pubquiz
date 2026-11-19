# 02: Every session write reads the live results

**What to build:** A change module can no longer leave the standings stale by setting a flag wrong. `touchedScores` is removed from `SessionChange` (now `{ session, outcome }`) and from every change module: the move committer (and its literal `true` type), answers (its refresh helper stops returning the flag), bonus awards, jokers, purchases, roster, player count, sides, feedback, showdowns, settings, league, timer expiry, and live edit's quiz edit change.

The Session write module waits at the standings gate and runs the live results read on every write, so its doc comment ("every session write ends with the live results read") becomes true. A failing read still keeps the earlier results and logs, as now.

League tables are flagged when the status enters or leaves `ended`, or when the session was ended before and after the write and the stored leaderboard or departed teams differ from the started session's (structural comparison). This replaces "was ended and the flag was set". Any Stryker-disable comment on the old flag goes with it.

Nobody on the night sees a difference: the same standings after every press, grade, award and edit. The accepted cost is the read's four queries on writes that used to skip it. See the spec's Implementation Decisions.

**Blocked by:** 01 (Inline the one-caller session updates). Both edit the same change modules.

**Status:** ready-for-agent

- [ ] `touchedScores` appears nowhere in backend source, and the `SessionChange` doc comment no longer mentions it.
- [ ] Session write spec: a change that writes a bonus award and returns only `{ session, outcome }` is stored with the fresh leaderboard.
- [ ] Session write spec: in an ended session, a write that changes the leaderboard or departed teams flags league tables, and a write that changes neither (for example a text-scale change) does not. Entering and leaving `ended` still flag them.
- [ ] Session write spec: a failing live results read still stores the write with the earlier results.
- [ ] Write-gate specs that relied on a write skipping the standings gate are updated. Every write now reaches it.
- [ ] The existing change-module and gateway specs pass.
- [ ] `pnpm crap:changed` and `pnpm --filter backend mutate:changed` are clean on the touched files.
