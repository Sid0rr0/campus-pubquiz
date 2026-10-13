# 01: Extract the Game module from the app module

**What to build:** The backend boots and runs a quiz exactly as before, but its live-game providers now live in a Game module that the app module imports. The real-store harness can then build from that module (ticket 03) instead of wiring providers by hand. This ticket doesn't touch the harness.

- **The Game module provides the live game:**
  - the Live session module, Session write, Block grading, the gateway and the Live edit module;
  - the progress repository;
  - the domain providers they depend on: seed, team, answer, standings, bonus, feedback, showdown and quiz.
- **It imports the auth module** for the login session store. It relies on the global database module for repositories, as the app does today, and doesn't import the database module itself.
- **It exports whatever the app module's controllers inject** (for example the Live session module, the gateway, the answer, bonus, team, quiz and seed providers). Check each controller's and each remaining app-module provider's constructor, and export exactly what they need.
- **The app module imports the Game module** and drops those providers from its own list. Controllers, import, media, stats, Sentry, the throttler and the global exception filter stay in the app module.
- A provider stays in the app module unless the live game or the Live edit module needs it.

Parent spec: `.scratch/real-store-harness-module/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] The backend boots (`pnpm dev:backend`) with no Nest dependency-resolution error. On the running app, a quiz can be started from `/control` and a team can join from `/play`.
- [x] The app module's provider list no longer contains any live-game provider. Each one is listed once, in the Game module.
- [x] The real-store harness is unchanged, and every backend spec passes unchanged.
- [x] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
