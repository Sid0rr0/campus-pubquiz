# 02: Kill the Team link and browser storage survivors

Status: done

Blocked by: `01-wire-up-and-baseline.md`

**Type:** task

Survivors from the 2026-10-24 baseline in `.scratch/mutation-testing-frontend/spec.md` (counts are survived, no coverage):

`app/lib/use-team-link.ts` (54 survived, 9 no coverage), `team-link.ts` (25, 4), `team-storage.ts` (1, 1), `player-count-prompt-storage.ts` (5, 1), `seen-questions.ts` (2, 1), `player-settings-storage.ts`, `display-code-storage.ts`.

The reconnect/team identity path, so real gaps matter most here (see `CODING_STANDARDS.md` on the reconnect path). Decide per cluster between a direct spec on the module and a sharper assertion in the existing join/reconnect component specs.

Work it as in `.scratch/mutation-testing/spec.md` "How to work an issue": list the survivors from `apps/frontend/reports/mutation/mutation.html` (run `pnpm --filter frontend mutate --mutate <file>`), split real gaps from equivalent mutants, kill the real ones with the sharpest spec at the right level (direct spec or component assertion, decided here), and note what was left and why.

Done when:

- each real survivor in these files is killed or recorded as equivalent in the ticket;
- `pnpm --filter frontend test` passes.

## Outcome

Every file in the ticket now scores 100% (no survivors, no uncovered mutants) with `pnpm --filter frontend mutate --force --mutate <file>`. Note: a plain incremental rerun reuses the old result of a static mutant (a module-level constant) even after a new spec is added, so use `--force` to re-check one.

Killed with new specs:

- `team-link.ts` (reducer): `team-link-reducer-edges.test.ts` — empty team code field from storage, submit with only a name or only a code, leaving a session (URL game code kept only on logout, confirm timer stopped when an answer is pending, a join accepted after a kick is ignored), the lobby restart rule, same-connection vs new-connection handling (link, retry count, last status), a seat-taken refusal retried for a team the server already accepted, a stale `joinRetryDue`, a late result for a send made before the team data was cleared, the confirm timer commands, a join accepted without the optional parts, a zero-point bonus toast, the joker toast rules, the unknown-input throw.
- `use-team-link.ts` (adapter): `use-team-link-adapter-edges.test.ts` — URL arguments seeding the form, the typed team code, `preventDefault`, toast durations, the confirm timer stopped by an acknowledgement and by unmount, the retry timer cancelled on unmount, a new identity wiping seen questions and team data (and the page mount / logout not doing so), the join guard released only by a refused connection, the reconnecting bar hidden under a join error or kick notice, rating and feedback recorded only on success, the first view feeding the seen questions.
- Storage helpers: `team-storage.test.ts` (`clearStoredSession` both modes), `display-code-storage.test.ts` (new), `player-count-prompt-storage.test.ts` (new, including blocked storage), `player-settings-storage.test.ts` (stored values and keys), `merge-seen-questions.test.ts` (same map back when nothing is added, missing fields).

Recorded as equivalent with `// Stryker disable` comments:

- `team-link.ts` `syncJoker`: `state.myJoker?.source` optional chain — `roundId` is always a number, so with no held joker the first comparison is already true and the second is never reached.
- `use-team-link.ts`:
  - every hook dependency array (`ArrayDeclaration`): they list only stable references (`dispatch` and `emitWithAck` are `useCallback(…, [])`, `forceReconnect` depends on one, Next's `router` is stable);
  - `clearJoinRetryTimer` and its call: a leftover retry timer fires `joinRetryDue`, which the Team link re-checks, so at worst a rejoin goes out early;
  - `answerWaitersRef.current.delete(attempt)`: a leftover waiter is only resolved a second time, which a promise ignores;
  - the `clearConfirmTimer()` inside `armConfirmTimer`: the Team link always emits `clearConfirmTimer` just before it;
  - the `default:` guard of `runCommand`: `command` is `never` there;
  - `if (linkRef.current.connection)` before `disconnected`: with no connection held, `disconnected` only restates null/false fields;
  - the connection counter (`counter.last !== socketConnection` and `count += 1`): the effect only runs when `socketConnection` changes, and ids are only compared for equality.

Found on the way: `vi.spyOn(Storage.prototype, 'getItem')` does nothing under happy-dom (`window.localStorage.getItem` does not read the prototype), so the "works with storage unavailable" tests in `app/display/__tests__/reconnect.test.tsx` and `app/play/__tests__/player-count.test.tsx` never actually block storage. `vi.spyOn(window.localStorage, 'getItem')` does. Not changed here.
