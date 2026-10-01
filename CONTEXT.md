# Campus Pub Quiz — Domain Language

Terms the code and specs use with one fixed meaning.

## Move plan

What one press of Advance or Previous does right now, decided once in the Live session module (`planMove`, `apps/backend/src/game/state/move-plan.util.ts`) and nowhere else. It resolves to a single step: reveal the next leaderboard rank, hide the leaderboard, a showdown or closest_guess reveal step, a state-machine transition, or nothing.

The leaderboard takes precedence — while it is up, a press only reveals a rank or hides the board and never moves the quiz underneath, and Previous is covered. Otherwise the step is whatever the quiz underneath would do.

The action handler carries the step out, the admin view announces it (`advanceStep`, `previousState`), and the presenter preview describes it. Clients render the announced step and send only `ADVANCE` or `PREVIOUS`; they never work out what a press means themselves.

## Settle step

The one pure step in the Live session module (`settleSession`, `apps/backend/src/game/state/session-settle.util.ts`) that derives every progress-dependent field of a session: the phase timer, the auto-lock and kahoot deadlines, the break end time, the leaderboard reveal count and the closest_guess reveal step. It takes one named input — the session (already graded, when grading applies), the progress it is moving to, the causing action or none, the time, and for restore the saved phase timer — and its internal order is fixed (phase timer first, since the kahoot deadline reads it).

Creating a session, restoring after a restart and Advance/Previous are its only callers; nothing else computes those fields.

## Status groups

Named, read-only sets of game statuses in shared types next to the state machine, each the single definition of what it means; every status list in the backend and frontend reads one. Membership is pinned by a table test.

- **answering** — question_open, locking, round_intro: teams can answer
- **question on air** — question_open, locking
- **grading** — break_intro, break, break_round_intro: the block is being graded
- **graded** — grading plus reveal_intro, reveal, ended: grading can be trusted
- **revealing** — reveal_intro, reveal
- **block review** — grading plus revealing: the phone's break and reveal screens
- **block started** — answering plus graded: every status where a block's questions exist
