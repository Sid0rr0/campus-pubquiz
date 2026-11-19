# 03: The screen preview reads the transition facts

**What to build:** The screen preview's "Results, then …" wording for leaving a break with Early answer reveal on comes from the *leaves the break into results* fact instead of restating the rule. The preview and the real press now agree because they read the same module. No behaviour change. Also updates `DOCUMENTATION.md`'s statuses section to name the transition facts where it lists what moves set off.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The screen preview has no break-exit rule of its own; it reads the fact
- [ ] Screen preview tests still show "Results, then Round N intro" and "Results, then final standings" for the Early answer reveal's break exit, and the plain screen description otherwise
- [ ] `DOCUMENTATION.md` names the transition facts in its statuses section; no protocol change
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
