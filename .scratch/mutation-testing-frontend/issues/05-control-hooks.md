# 05: Kill the Control panel hooks and shortcuts survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/control/admin-keyboard-shortcuts.ts` (15), `use-admin-keyboard-shortcuts.ts` (16, 3), `app/lib/use-admin-game.ts` (15).

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

## Outcome

All three files now score 100% (no survivors, no uncovered mutants).

- `admin-keyboard-shortcuts.ts` (14 string literals): new direct spec `control/__tests__/admin-keyboard-shortcuts.test.ts` pins every key name and requires a non-empty description. The guide spec's `toContain` passed for an empty string.
- `use-admin-keyboard-shortcuts.ts`: specs added for `preventDefault` on every bound key, unbound keys with the leaderboard up (kills `true &&` and `if (true)`), TEXTAREA/SELECT focus, and `useAdminMediaPauseShortcut` (previously untested here: Space, other keys, rerender deps).
- `use-admin-game.ts`: specs for broadcasts while no question is focused, focus cleared back to null, and state kept when the hook is switched off (`enabled` false).

Equivalent, disabled in source with a reason:

- `use-admin-keyboard-shortcuts.ts` `matchesKey`: dead code. The `length === 1` condition and the named-key branch cannot be reached, since every shortcut routed through it (`j`, `f`, space, `m`) is a single character; the named keys (arrows) are matched directly elsewhere. Re-examined in review: no test can reach it without changing `ADMIN_SHORTCUTS`, so the disables stay and behaviour is unchanged. Removing the branch is a separate decision.
- `use-admin-game.ts`: the `useCallback` dependency arrays (ArrayDeclaration); every listed reference is stable for the life of the hook. Each is disabled on its own line with its own reason; the two `[]` arrays after a callback's closing brace (`bindSocket`, `focusAnswersQuestionId`) use narrow ranges, because Stryker ignores a `next-line` comment above a `}, []);` line.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.
