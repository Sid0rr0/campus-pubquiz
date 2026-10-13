# 03: Build the real-store harness from the Game module

**What to build:** Every real-store spec drives the same provider graph the app runs. The harness compiles the Game module over the test database module instead of building providers by hand, so a constructor change in the game code is made once, and a provider the Game module forgets fails the harness straight away. No spec body changes.

- **The harness compiles the Game module** with Nest's testing module, together with the test database module from ticket 02. It overrides only:
  - the login session store, with the existing fake session service (the only true override).

  The phase timer schedulers token is `@Optional()` and unregistered in production, so it is not overridden: the harness supplies a pair of manual schedulers through a small global test module.

  After init it attaches the mock socket server to the gateway, as today. If the session-broadcaster spec has landed, it attaches the server through the broadcaster's init hook instead.

- **Lifecycle comes from Nest.** The harness initialises the module, which runs module init (the session store loads) and then application bootstrap (timers re-arm). At the end of the test it closes every module it compiled, which runs module destroy (armed timers are cleared). Modules close before the tables are emptied, as the current hook order does. The harness's own calls to those hooks go, and so does the hand-built provider graph.
- **`restart()` compiles and initialises a fresh Game module over the same database.** As today, the earlier module stays alive until the test ends, so a spec can still use the handle it held before the restart.
- **The handle is unchanged.** Every field keeps its name and type, and each provider on it is resolved from the compiled module. `holdNextCall` and `rejectNthCall` keep working because they patch those same instances. `settled`, `nextWriteWaiting`, `timers`, `saveQuizEdit`, `saveAnswerKeyFix`, `act`, `resync`, `snapshot`, `inRequestContext`, and the connect and join helpers behave as today.
- **Suite time:** measure the full backend run before and after. If it is measurably slower, fix that before landing (for example by caching what can be compiled once per file). Don't drop the change.
- **Docs:** if a module diagram in `docs/architecture.md` lists the app module's providers, group the live-game ones under the Game module.

Parent spec: `.scratch/real-store-harness-module/spec.md`

**Blocked by:** 01 (Extract the Game module from the app module), 02 (A test database Nest module over the worker's ORM).

**Status:** done

- [x] The harness no longer constructs any live-game provider or repository with `new`, and no longer calls a lifecycle hook itself.
- [x] The real-store smoke spec checks that the handle's providers are the module's instances: the gateway's Live session module is the handle's `gameState`, and the Live edit module's Session write is the Live session module's.
- [x] Every real-store spec passes with no change to any spec body. That includes restart, phase-timer, session-write race and failing-delivery specs, and the live-edit specs.
- [x] The full backend run stays under 60s on a laptop. Record the before and after times in the ticket's comments.
- [x] `docs/architecture.md` is updated if one of its diagrams lists the app module's providers.
- [x] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.

## Comments

- Full backend run (`pnpm --filter backend test --maxWorkers=2`, jest-reported time), measured on the same machine:
  - Before (integration tip 4894737b): 69.3s (154 suites, 2392 tests).
  - After: 61.9s (154 suites, 2394 tests). Not slower, so no metadata caching was needed. Both numbers carry noise from other jobs on the machine; the 60s budget is a laptop figure with default workers.
- Re-measured on the final tip with default workers (`pnpm --filter backend test`, foreground), jest-reported time: this branch 33.1s (154 suites, 2394 tests), `main` tip 595c08d0 (the merge-base) 33.5s (153 suites, 2387 tests); wall clock about 40s for both. So the 60s box holds, and the suite is not slower than before. The earlier 69.3s/61.9s figures (`--maxWorkers=2`, machine under load) were not default-worker numbers.
- The Game module leaves `PHASE_TIMER_SCHEDULERS` to its host (nothing provides it in production), and overriding an unregistered token is a no-op, so the harness provides it through a small global module holding the manual schedulers. Only the session store is a true `overrideProvider`.
- Closing a compiled module never closes the worker ORM: the test database module only hands the ORM out. Verified by the full run (later spec files on the same worker still connect).
- `docs/architecture.md` already groups the live-game providers under the Game module (ticket 01); no diagram change.
