# Spec: Build the real-store harness from a Game module, not by hand

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-13, candidate 3 ("Build the real-store harness from the Nest module").

## Problem Statement

About 85 backend spec files drive the game through the real-store gateway harness: a real Postgres database, a mock socket server and manual timer schedulers. The harness is the most-churned test file in the backend: 28 commits since September, and most recent ones change wiring, not test behaviour.

- **The harness rebuilds Nest's dependency injection by hand.**
  - It builds every repository from the entity manager, then about ten providers with `new`. That includes the Live session module (eleven constructor arguments), Session write, Block grading, the gateway and the Live edit module.
  - It calls each lifecycle hook (module init, application bootstrap, module destroy) itself, in the order it believes Nest uses.
  - Every constructor change in the game code therefore has to be made twice: once for Nest and once in the harness. Recent examples: making Session write and Block grading providers, moving the session store into the Session write module, and the Live edit module taking over the quiz edit. The session-broadcaster spec on the board will need a third copy.
- **The harness can drift from the app.** Nothing checks that the hand-built graph matches what Nest builds. A provider registered in the app but forgotten in the harness, or wired with a different collaborator, passes every spec while the running app behaves differently. The reverse also happens: a provider added to the harness but not registered with Nest is only caught when the app boots.
- **The app has no unit to build from.** Every live-game provider is listed directly in the app module, next to auth, media, import, stats, Sentry and the throttler. A test that wants "the live game, over a database" has to choose between building it by hand (today) and compiling the whole app with half a dozen overrides.

## Solution

The live-game providers move out of the app module into a **Game module**, which the app module imports. The real-store harness compiles that Game module with Nest's testing module, over the test database, and overrides only the true adapter, the login session store (the fake session service), supplies the phase timer schedulers (manual schedulers) through a small global test module, and, as today, the socket server (the mock server).

The harness's handle keeps every name it has today, and each provider on it is the one Nest built, so no spec body changes. A constructor change in the game code is then made once. A provider the Game module forgets fails the harness straight away.

Nothing changes for the quiz master, the teams, the big screen or the database. The app boots and runs exactly as before.

## User Stories

1. As a quiz master, I want the backend to boot and run a quiz exactly as before, so that this test-infrastructure change is invisible on quiz night.
2. As a developer adding a constructor argument to a live-game provider, I want to change only the provider, so that I don't also hand-wire it in the test harness.
3. As a developer adding a new live-game provider, I want to register it once in the Game module and have both the app and the harness pick it up.
4. As a developer, I want the harness to fail if the Game module can't resolve a provider, so that a wiring mistake shows up in the test run and not only when the app boots.
5. As a developer, I want every real-store spec to drive the same provider graph the app runs, so that a passing spec means the wired-up app behaves the same.
6. As a developer, I want lifecycle hooks (loading the session store at init, re-arming timers at bootstrap, clearing timers at destroy) run by Nest in Nest's order, so that the harness can't call them in an order the app never uses.
7. As a developer writing a real-store spec, I want the handle to keep `gateway`, `gameState`, `answerService`, `standingsService`, `progressRepository`, `liveEdit`, `settled`, `timers`, `restart` and the rest under the same names, so that my spec doesn't change.
8. As a developer whose spec holds or rejects a call on a collaborator (e.g. the progress repository's save, the standings read), I want that to keep working on the instance the module built, so that my race and failure specs stay deterministic.
9. As a developer testing a backend restart, I want `restart()` to build a fresh Game module over the same database, so that progress, timers and standings come back through the same path a real restart uses.
10. As a developer, I want each test's modules torn down before the tables are emptied, so that no armed timer fires into an empty database or keeps the worker alive.
11. As a developer, I want the harness to reuse the worker's test database connection, so that compiling a module per test doesn't open a new connection pool each time and slow the suite down.
12. As a developer, I want closing a test's module never to close the worker's shared database connection, so that the next spec file on the same worker still has a database.
13. As a developer reading the app module, I want the live-game providers grouped in one Game module, so that I can see what makes up the live game.
14. As a developer working on the session-broadcaster spec, I want to add the broadcaster to the Game module and have the harness pick it up, so that the change doesn't also rewire the harness.
15. As a developer, I want the full backend suite to stay as fast as the backend-test-speed spec left it.

## Implementation Decisions

- **New Nest module: the Game module.** It provides the live game: the Live session module, Session write, Block grading, the gateway, the Live edit module, the progress repository, and the domain providers they depend on (seed, team, answer, standings, bonus, feedback, showdown, quiz). It imports the auth module for the login session store, and exports what the app module's controllers inject. The app module imports it and drops those providers from its own list. Controllers, import, media, stats, Sentry and the throttler stay in the app module.
  - A provider stays in the app module unless the live game or the Live edit module needs it.
  - If a controller in the app module needs one that moved, the Game module exports it.
  - The Game module relies on the global database module for repositories, as the app does today. It doesn't import the database module itself.
- **The harness compiles the Game module with Nest's testing module.** Over it, the harness provides:
  - **The database:** a test-only global module that provides the ORM, its entity manager and the entity repositories from the worker's ORM (the one `useTestDatabase` already holds), not from the production config. Repositories still resolve from the global entity manager, so the gateway's request-context handlers fork their own entity manager per call, as in the app. Closing a test's module must not close that ORM.
  - **Overrides:** the login session store becomes the existing fake session service (the only true `overrideProvider`). The phase timer schedulers token is `@Optional()` and unregistered in production, so there is nothing to override: the harness supplies a pair of manual schedulers through a small global test module. Nothing else is overridden.
  - **The socket server:** the mock server is attached to the gateway after init, as today. When the session-broadcaster spec lands, it is attached through the broadcaster's init hook instead.
- **Lifecycle comes from Nest.** The harness initialises the testing module, which runs module init (the session store loads) and then application bootstrap (timers re-arm). It closes the module at the end of the test, which runs module destroy (armed timers are cleared). The harness's own calls to those hooks go. The order of test hooks stays as it is: modules close before the tables are emptied.
- **`restart()` compiles and initialises a fresh Game module over the same database**, like a backend restart: progress and timers come back from persistence, while sockets and connected teams don't. As today, the previous module stays alive until the test ends, so a spec can still use the handle it held before the restart. Both are closed at teardown.
- **The handle is unchanged.**
  - Every field keeps its name and type. Each provider on it is resolved from the compiled module, so it is the instance the gateway and the Live session module use.
  - `holdNextCall` and `rejectNthCall` keep working, because they patch those same instances.
  - `settled`, `nextWriteWaiting`, `timers`, `saveQuizEdit`, `saveAnswerKeyFix`, `act`, `resync`, `snapshot`, `inRequestContext` and the connect and join helpers behave as today.
- **No behaviour, wire, schema or migration change.** The app's provider graph is the same set of providers, only grouped differently.
- **Docs, in the same change:**
  - `docs/architecture.md`: if a module diagram shows the app module's providers, group the live-game ones under the Game module.
  - `GLOSSARY.md`, `DOCUMENTATION.md`, `CODING_STANDARDS.md` and the `/guide` page need no change. "Game module" is a code-structure name, not a domain term.

## Testing Decisions

- **One seam: the real-store harness itself, now built from the Game module.** The verification is that every spec built on it (about 85 files) passes with no change to any spec body. A good real-store test drives the game through the gateway, the Live session module or the Live edit module, and asserts what rooms were sent or what was stored. It never depends on how the harness wired the providers.
- **The harness's own checks** go in the existing real-store smoke spec:
  - The handle's providers are the instances the module built: the gateway's Live session module is the handle's `gameState`, and the Live edit module's Session write is the Live session module's Session write.
  - A `restart()` handle resolves fresh instances over the same database. The restored session's progress and armed timers match what was persisted, which the existing restart specs already cover.
  - Closing a test's modules leaves the worker's database usable. The next test in the same file seeds and plays normally, and the existing test database isolation specs keep passing.
- **The app's wiring stays checked by the app booting** (`pnpm dev:backend`) and by typecheck, as today. No new test compiles the whole app module: it would need the same overrides this spec avoids. The Game module itself is now compiled in every real-store spec, so it is checked on every run.
- **Suite time:** the full backend run stays within the backend-test-speed spec's budget (under 60s on a laptop). Measure before and after. If compiling a module per test is measurably slower, fix it before landing, for example by caching the compiled module's metadata. Don't drop the change.
- **Prior art:** the Nest testing-module specs in the app (the app controller spec and the media HTTP spec) for compiling a module with overrides; the real-store smoke spec for harness-level checks; the backend-test-speed spec's test database module for how a spec gets the worker's ORM.

## Out of Scope

- **Changing how specs force interleavings or failures** (`holdNextCall` and `rejectNthCall` on the progress repository, the standings read, the seed load and others). These spec patches stay: about 50 uses in 9 files. A deliberate concurrency seam around the session write is a separate decision.
- **Making the session write queue an injectable provider**, so that `nextWriteWaiting` stops reaching into Session write's private queue.
- **The answer-service and showdown-service harnesses.** They build one or two providers each and don't churn.
- **Moving the controllers into the Game module, or splitting the app module further** (auth, media, import, stats).
- **A test that compiles the full app module.**

## Further Notes

- **Overlap with the session-broadcaster spec** (ready-for-agent). That spec adds a provider, has the gateway and the Live edit module take it, and wires it by hand into today's harness. If this spec lands first, the broadcaster only needs to be added to the Game module, and the harness changes reduce to attaching the mock server through the broadcaster's init hook. If the broadcaster lands first, this spec simply includes it in the Game module. Neither blocks the other. Landing this one first saves the broadcaster spec its harness rewiring.
- **Overlap with block-grading-moves and grading-mode-policy.** Both change Block grading's or the answer module's interface. Neither changes their constructors, so neither needs harness changes once this spec lands.
- `@mikro-orm/nestjs` closes the ORM it registered when the module shuts down. The test database module therefore must not hand the worker's ORM to anything that will close it. Check this explicitly. The symptom would be the second spec file on a worker failing to connect.
