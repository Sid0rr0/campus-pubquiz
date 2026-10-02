# 04: A press no longer overwrites changes made while it runs

**What to build:** When the quiz master presses Advance, or a phase or lock timer expires, at the same moment a team submits, joins or gets a bonus, that change survives. Today a press takes the session as it stood when the press began, grades, settles and saves progress, then stores its own copy, wiping out anything that landed while it waited on the database. This is the user-visible lost-update bug.

The admin press and both timer expiries become session writes. Commit a move runs inside the write against the session as the previous write left it, and the write stores what Commit a move returns. A refused press (illegal transition, Advance waiting for grading) or a failed progress save stores nothing and returns its error as today, and the next write runs against the unchanged session. Commit a move's own interface doesn't change. Its internal standings reads stay for now and are removed in 07.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 02, 03

**Status:** done

- [x] Written first, failing against today's code: an answer submitted while an Advance waits on its progress save is in the admin snapshot's answered markers and answer list once both finish.
- [x] A team joining while a press waits on its save shows as connected and on the leaderboard afterwards.
- [x] A bonus awarded while a timer expiry waits on its save is on the final leaderboard.
- [x] A kick during a press: the roster and leaderboard both lose the team, and it doesn't come back.
- [x] A refused Advance out of the break (an ungraded answer), followed by a grade: the press reports its refusal, the grade lands, and the session hasn't moved.
- [x] A progress save that rejects once, followed by an answer: the press reports its failure and the answer still lands.
- [x] The commit-a-move, admin-actions, timer and agreement-walk specs pass unchanged.

## Comments

Implemented in the commit `feat(backend): a press keeps changes made while it runs` (see git history for the hash). `applyAdminAction`, which the admin press and both timer expiries all call, is now a session write that runs Commit a move against the session as the previous write left it. Commit a move's interface is unchanged and its own standings reads stay for 07, so a press now reads standings once more at the end of the write. The held-save specs for an answer, a join, a kick and a lock-timer expiry with a bonus failed against the old code. The refused-press-then-grade and failed-save-then-answer specs already held and are kept as guards. Known gap, for 06: disconnects and the break end time still store directly, so one landing mid-press can still be overwritten.
