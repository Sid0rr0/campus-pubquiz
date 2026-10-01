# Campus Pub Quiz — Domain Language

Terms the code and specs use with one fixed meaning.

## Move plan

What one press of Advance or Previous does right now, decided once in the Live session module (`planMove`, `apps/backend/src/game/state/move-plan.util.ts`) and nowhere else. It resolves to a single step: reveal the next leaderboard rank, hide the leaderboard, a showdown or closest_guess reveal step, a state-machine transition, or nothing.

The leaderboard takes precedence — while it is up, a press only reveals a rank or hides the board and never moves the quiz underneath, and Previous is covered. Otherwise the step is whatever the quiz underneath would do.

The action handler carries the step out, the admin view announces it (`advanceStep`, `previousState`), and the presenter preview describes it. Clients render the announced step and send only `ADVANCE` or `PREVIOUS`; they never work out what a press means themselves.
