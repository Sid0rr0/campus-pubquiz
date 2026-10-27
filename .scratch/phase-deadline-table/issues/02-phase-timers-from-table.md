# 02: Arm, clear and expire the phase timers from the table

**What to build:** The phase timers handle every deadline in the phase deadline table the same way. Each session gets one timer per table key. Arming, restoring after a restart and clearing all loop over the table. One expiry handler, still forking its own request context, takes the deadline key and reads its log label from the table. It still advances only if the session holds the deadline the timer was armed to, and logs failures under the same labels as today ("Auto-lock", "Kahoot auto-lock", "Joker pick close"). The scheduler swap is a record keyed by deadline name, each falling back to the real-timer scheduler. The real-store harness builds it from its three manual schedulers and keeps exposing them to specs as `lock`, `kahoot` and `jokerPick`. Quiz masters see no change on stage.

**Blocked by:** 01 (Add the phase deadline table and drive the deadline change from it)

**Status:** ready-for-agent

- [ ] The phase timers hold one timer registry per table key, not three named fields
- [ ] `arm`, `restoreAll` and `clearAll` loop over the table
- [ ] The three expiry handlers are one, reading its label from the table; log text unchanged
- [ ] The injected schedulers are keyed by deadline name; production still provides none
- [ ] The real-store harness's spec-facing `lock` / `kahoot` / `jokerPick` timer controls are unchanged
- [ ] Every phase timer spec (lifecycle, harness, question lock auto-advance and isolation, kahoot question timer and auto-advance, joker pick, outcome delivery and timers, outcome delivery deadlines) and the timer registry spec pass unchanged
- [ ] Stryker disable comments in the phase timers and Session write are re-checked; any made obsolete by the loop are dropped
