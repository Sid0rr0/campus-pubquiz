# 02: Running sessions list leaves the session picker

**What to build:** Extract the running sessions list from the session picker panel into its own component (see [spec](../spec.md)). It takes the running sessions, a close handler and an open-session handler, and renders the "No sessions running yet." message and one row per session: name, status, team count, join code with copy, start time, Close (ended sessions only), Remote and Control (every session). The panel keeps the sessions query and the close mutation.

**Blocked by:** 01

**Status:** done

- [x] Behaviour, wording, accessible names and roles are unchanged.
- [x] No standalone test for the component; the existing session picker and sessions page tests pass unchanged.
- [x] `pnpm --filter frontend test`, `pnpm typecheck` and `pnpm lint` pass.
