# 01: Build the change modules in one place

**What to build:** A prefactor that makes the later tickets easy. The 13 live session change modules and the move pipeline are built by one provider, created once from the same injected stores and the joker random source, rather than by hand in the game state class's constructor. The game state class uses that provider. Quiz masters and teams see no difference. See the spec's "The live session change modules".

**Blocked by:** None within this spec. The spec as a whole waits on session-change-cleanup.

**Status:** ready-for-agent

- [ ] One provider builds every change module and the move pipeline; the game state class's constructor no longer builds them
- [ ] The joker random source can still be injected for tests, as today
- [ ] The change modules' own interfaces are unchanged
- [ ] Every existing spec passes without changing its expectations
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
