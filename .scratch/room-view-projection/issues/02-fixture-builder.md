# 02: One fixture builder makes real room views

**What to build:** A frontend test can describe a small quiz and where the session is, and get back the exact view each room would be sent. The fixture builder takes a partial description: rounds (a small default quiz), progress (the lobby by default), teams, answered teams, leaderboard, timers, the showdown and settings. It returns full session state, filling every other field from the fresh-session factory. A room-view helper runs the shared projection for a role.

The existing per-role helpers stay, and no page test changes in this ticket.

Parent spec: `.scratch/room-view-projection/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The builder and the room-view helper live in the frontend's shared test support, where all three role folders can import them.
- [ ] A test of the builder itself: with no input, each role gets a valid lobby view; a description that opens a question gives a players view that is answerable, with that question in the block; under the leaderboard with a reveal count, the admin view's Advance step is a reveal step.
- [ ] The builder never sets a view field directly. Everything comes from the projection.
- [ ] `pnpm typecheck` and the frontend suite pass.
