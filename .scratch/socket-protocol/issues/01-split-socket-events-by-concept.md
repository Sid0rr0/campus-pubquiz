# 01: Split the socket-events file by concept

**What to build:** The shared socket-events file (813 lines, about ten concepts, edited by almost every backend feature) becomes one module per concept, so that a feature touches the module it's about. Nothing changes for anyone importing shared types: every name is still exported from the package root, and no import site changes. No type is renamed or reshaped, and nothing changes on the wire.

The modules, as the spec lists them:

- **socket protocol**: event names, rooms, the handshake query, the session-room naming helper, `AckResult`;
- **question views**: question, reveal, block, pending closest_guess reveal, upcoming position and round title views, the closest_guess reveal data;
- **room views**: the shared snapshot, the display, admin and players views, `StateViewByRoom`, the leaderboard entry, the team view, the Advance slot step, the Previous state, the presenter context and the admin question context;
- **answers**: submit, received, team answer, answer view, answers updated, grade, team answers synced, the "I don't know" value;
- **team presence**: join, join accepted, kick, leave, session closed;
- **session settings**: `SessionSettings`, its frozen default (with its comment), the display text-size steps and default, the kahoot timer default;
- **bonus**: categories, award payload, team and admin award views, the awarded payload, the awards list and update bodies;
- **feedback**: comment and topic limits, the round rating and team feedback views, the rate-round and send-feedback payloads;
- **showdown**: create and guess payloads, participant and active showdown views;
- **REST**: quiz summaries and listing, session creation, active session summary.

Module names follow the shared types package's existing naming. A type that two concepts use sits in the lower-level module and the other imports it, with no import cycles between them. This is the prefactor the rest of the spec builds on: the later typing changes then show up as small diffs on top of types that have already moved.

Parent spec: `.scratch/socket-protocol/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The socket-events file is gone (or holds only the socket protocol concept), and each concept above lives in its own module.
- [ ] The package root re-exports every module; `git diff` shows no import changes in the backend or frontend.
- [ ] No exported name is added, removed, renamed or reshaped (comparing the package's built type declarations before and after shows the same exported names).
- [ ] No import cycles between the new modules.
- [ ] `pnpm typecheck`, `pnpm lint`, `pnpm build` and `pnpm test` pass across all workspaces.
