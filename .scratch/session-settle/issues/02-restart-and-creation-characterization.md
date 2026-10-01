# 02: Restart and creation pin the derived session fields

**What to build:** New real-store gateway harness cases that pin how a session's progress-dependent fields come out of a restart and out of session creation, passing against today's code. They are the safety net for moving creation and restore onto the settle step.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] A restart mid-kahoot-question restores the exact remaining question deadline from the saved phase timer, and the question auto-locks on time
- [x] A restart mid-phase restores every phase's elapsed time exactly, downtime included
- [x] A restart mid-countdown on a break point's last question still re-arms the auto-lock fresh from the restore time (today's deliberate tradeoff) — extend the existing case if it doesn't already assert the deadline
- [x] A freshly created session starts in the lobby with no auto-lock or kahoot deadline, no break end time, an empty leaderboard reveal and closest_guess step zero
- [x] Cases use the harness's restart helper and fake clock; no production changes; all pass against the current code

## Comments

Implemented as tests only, all passing against the current code (full backend suite green):

- `kahoot-question-auto-advance.spec.ts`: restart mid-kahoot-question keeps the exact deadline and still auto-locks on the original deadline, not one re-armed from the restart.
- `phase-timer-lifecycle.spec.ts`: restart (with 60s of downtime) restores the live phase's start and the closed phase's elapsed time exactly.
- `session-creation-defaults.spec.ts` (new): a created session is in the lobby with no lock/kahoot deadline, no break end time, reveal count 0 and closest_guess step 0, even after a dirtied previous session.
- Countdown restart: the existing case in `question-lock-countdown.spec.ts` already asserts the re-armed `questionLockAt`, so it was left as is.
