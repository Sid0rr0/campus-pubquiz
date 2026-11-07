# 02: /control asks the quiz mode

**What to build:** `/control` decides which settings to show and send from the quiz's mode, through the Quiz mode module, so it can't drift from what the server refuses. The lobby learns the mode from the snapshot instead of reading round 0's quickfire flag. The quiz master sees the same start dialog and lobby settings as today.

Parent spec: `.scratch/quiz-mode-module/spec.md`

**Blocked by:** 01 (The Quiz mode module)

**Status:** ready-for-agent

- [ ] The shared snapshot carries the session's quiz mode; its per-round quickfire field stays for `/play` and the big screen. `DOCUMENTATION.md`'s protocol section lists the new field.
- [ ] The start-session dialog, the lobby's settings panel and the settings form take the quiz mode instead of a boolean, and ask the module what to show (joker switch, power-ups tab, coin fields, league picker, quickfire question timer) and what to send. The frontend's "without coin settings" helper is deleted.
- [ ] The `/control` lobby passes the snapshot's quiz mode to the settings panel, not the current round's quickfire flag.
- [ ] The settings form, settings panel and start-session dialog tests pass a mode and keep one rendering check per mode (quickfire hides jokers, power-ups, coins and leagues and shows the timer; pub the reverse); rule cases the module covers are dropped.
- [ ] `pnpm crap:changed` passes.
