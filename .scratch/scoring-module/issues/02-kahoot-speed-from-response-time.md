# 02: Kahoot speed from stored response time

**What to build:** Kahoot speed scaling reads each answer's response time stored at submit (measured from the phase start, overwritten on resubmission) instead of the answer's update timestamp. The in-memory per-question speed multipliers are removed from session state. Kahoot scoring at lock and later regrades both recompute from stored response times.

- A quiz master correcting a kahoot question's answer key after a backend restart keeps every team's speed scaling.
- A correction made before the question locks is speed-scored normally at lock.
- The regrade no longer skips kahoot questions that haven't been speed-scored yet.

See [spec](../spec.md) user stories 7, 8, 16–18 and 26.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Postgres test: speed-scaled points after a kahoot answer-key regrade, run from a freshly constructed answer/grading module with no in-memory state (restart), equal the points from a run without a restart.
- [x] Postgres test: a team that resubmits before lock is timed from its last submission.
- [x] Postgres test: answers with no stored response time get no scaling. With no timer configured, correct answers keep full points. Wrong answers stay at zero.
- [x] The session state no longer holds speed multipliers. The regrade path has no kahoot "not yet scored" skip.
- [x] The CLAUDE.md "Known Tradeoffs" entry about in-memory kahoot multipliers is narrowed to the part that still holds (live fixes overwrite manual overrides).

## Comments

Implemented in `feat(backend): speed-scale kahoot answers from stored response time`. Status line left as `ready-for-agent`; the triage vocabulary has no done state.

- `applyKahootSpeedScoring(session, question, timer)` now just delegates to `regradeAutoGraded(session, question, kahootTimerSeconds)`; both read `responseMs` stored at submit. `kahootSpeedMultipliers` is gone from session state, and the ensureKahootSpeedScored guard is the status-transition check only.
- The restart case is covered in `grading.spec.ts` (fresh `AnswerService` on a forked entity manager). The old gateway spec asserting "kahoot not yet scored is skipped" was rewritten to assert the corrected, speed-scaled stored points.
- DOCUMENTATION.md's live-edit paragraph was updated in the same commit.
