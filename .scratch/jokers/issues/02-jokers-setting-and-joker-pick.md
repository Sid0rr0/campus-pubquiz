# 02: Jokers setting and the joker pick

**What to build:** The tracer bullet. A quiz master turns on **Jokers** in the lobby; after the round overview the quiz moves to the **joker pick**. For 60 seconds each team picks its **joker round** on its phone (changing it as often as it likes), the big screen lists the rounds with a countdown, and `/control` lists every team's joker. Advance closes the pick early; otherwise its deadline presses Advance. A team that hasn't picked when it closes gets a random round, and its phone says so. Previous from the joker pick goes back to the round overview (reopening from the round intro is ticket 03).

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Session setting `jokersEnabled`, default off, lobby-only; a stored settings JSON without it reads as off; the settings schema refuses Jokers on with the round overview off (including a PATCH that changes only one of them)
- [ ] `/control` settings panel: a "Jokers" switch that turns the round overview on and disables the overview switch while on
- [ ] New `joker_pick` status, in no status group: `round_overview` → `joker_pick` → round 0's `round_intro` when Jokers is on (unchanged path when off); Previous from `joker_pick` → `round_overview`
- [ ] The joker pick deadline (fixed 60 s) as a third phase timer: set in the Settle step, armed by the Session broadcaster, restored after a restart, its expiry pressing Advance through Commit a move
- [ ] A per-session, per-team joker table (session, team, round, source `chosen` | `drawn` | `set_by_quiz_master`), kept apart from the roster row, with its migration
- [ ] `PICK_JOKER` (team) as a Session write that touches scores: accepted only while `joker_pick` is on air and for a round with no opened question; last write wins
- [ ] Closing the pick draws a joker for every team without one, with equal chance (injected random source in tests)
- [ ] Players view: the team's own joker only (`{ roundId, source }` or null) and, on `joker_pick`, the deadline and pickable rounds. Display view: deadline and round list, never a team's round. Admin view: every team's joker with its source
- [ ] Phone screen kind `joker_pick`: round cards, countdown to the server deadline, highlighted pick, "Saved ✓"; after close, "Your joker: Round N — title" ("drawn for you" when drawn) plus "Look at the screen"; a reconnect restores it
- [ ] Display screen kind `joker_pick`: every round (number, title, category, author) and the countdown
- [ ] `/control` shows every team's joker and its source (read-only here; overriding is ticket 04)
- [ ] Real-store harness specs for all of the above, including restart survival; pure transition specs; page specs from the `roomView` fixture
- [ ] `DOCUMENTATION.md` (status table and diagram, settings, screen kinds, protocol), `GLOSSARY.md` (Phase timers: three; status diagram) and `/guide` (the setting, running the pick) updated
