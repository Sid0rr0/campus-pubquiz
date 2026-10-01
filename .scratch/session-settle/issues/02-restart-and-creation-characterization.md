# 02: Restart and creation pin the derived session fields

**What to build:** New real-store gateway harness cases that pin how a session's progress-dependent fields come out of a restart and out of session creation, passing against today's code. They are the safety net for moving creation and restore onto the settle step.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A restart mid-kahoot-question restores the exact remaining question deadline from the saved phase timer, and the question auto-locks on time
- [ ] A restart mid-phase restores every phase's elapsed time exactly, downtime included
- [ ] A restart mid-countdown on a break point's last question still re-arms the auto-lock fresh from the restore time (today's deliberate tradeoff) — extend the existing case if it doesn't already assert the deadline
- [ ] A freshly created session starts in the lobby with no auto-lock or kahoot deadline, no break end time, an empty leaderboard reveal and closest_guess step zero
- [ ] Cases use the harness's restart helper and fake clock; no production changes; all pass against the current code
