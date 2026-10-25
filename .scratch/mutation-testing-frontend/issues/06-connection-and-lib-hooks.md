# 06: Kill the Connection and small lib hooks survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/lib/use-game-connection.ts` (15, 1), `use-seconds-left.ts` (8), `use-lock-countdown-sound.ts` (5), `use-toast-on-error.ts` (4, 1), `use-reconnect-on-wake.ts` (3), `use-display-screen-sounds.ts` (3), `bonus-categories.ts` (6, 1), `confetti.ts` (0, 5) and `download-text-file.ts` (0, 5) (browser-API wrappers: decide whether a spec is worth it or the mutants are equivalent/untestable).

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

## Result

All nine files now score 100% (every mutant killed, none survived or uncovered). Each got a direct spec in `app/lib/__tests__/`: new `use-seconds-left`, `use-toast-on-error`, `use-display-screen-sounds`, `confetti`, `download-text-file` and `bonus-categories` specs, and added cases in the `use-game-connection`, `use-lock-countdown-sound` and `use-reconnect-on-wake` specs. `confetti` and `download-text-file` were worth a spec after all: the canvas library is mocked and `URL.createObjectURL` is faked.

Equivalent mutants, marked `// Stryker disable` in the source:

- `use-game-connection.ts`: the dependency arrays of `reportConnection`, `emitWithAck` and `forceReconnect` (`[]` to a constant, `[reportConnection]` to `[]`). `reportConnection` never changes identity, so the callbacks are as stable either way.
- `use-lock-countdown-sound.ts`: `unlock`'s `[]` dependency array, same reason.
- `use-reconnect-on-wake.ts`: the subscribe effect's `[]` dependency array (a constant array still runs it once).

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
