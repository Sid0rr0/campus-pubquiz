# 03: A stale quickfire session restores with jokers, power-ups and coins off

**What to build:** A session stored before the quiz-mode migration, for a quiz that is now quickfire, can carry jokers or power-ups switched on in its stored settings. When the server loads any game (a new session or a restore after a restart), it applies the quiz's mode to the settings, so a quickfire session never opens a joker pick or offers power-ups or coins, whatever its stored row says. Stored rows aren't rewritten.

Parent spec: `.scratch/quiz-mode-module/spec.md`

**Blocked by:** 01 (The Quiz mode module)

**Status:** ready-for-agent

- [ ] The seed step that builds a session's settings from its stored row passes them through the module's "settings a mode plays with", after its existing defaults for older rows.
- [ ] A new seed-service case: a stored session row for a quickfire quiz with jokers and power-ups on loads with both off and no starting coins; a pub quiz row loads unchanged.
- [ ] The existing seed-service specs pass unchanged.
- [ ] `pnpm crap:changed` passes.
