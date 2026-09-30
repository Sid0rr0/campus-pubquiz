# 10: Contract: delete the fake-store harness

**What to build:** Once no spec uses them, the fake gateway harness pieces are deleted: the fixed-data fake answer store and its sibling fakes, and the separate concurrent-sessions fake fixture module. The real-store harness becomes the only way to test through the gateway. This is the contract step of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 07, 08, 09

**Status:** done

- [x] The fake answer store and the concurrent-sessions fake fixture module no longer exist, and nothing references them.
- [x] The full backend test suite passes.
- [x] Backend lint and build pass.

## Comments

Done in the commit titled `test(backend): delete the fake-store gateway harness`. `concurrent-sessions-test-utils.ts` was already deleted in ticket 09. This ticket removes everything else that faked the stores from `apps/backend/src/game/__tests__/test-utils.ts`: `createTestGateway`, the `createFake*`/`as*` services (seed, game-progress, team, answer, bonus, showdown), the seeded-game fixtures, `arrange`, and the old `openFirstQuestion`/`connectPlayer` helpers (the real-store harness has its own). It keeps what the real-store harness and other specs still import: `createFakeOrm` (auth bootstrap spec), the fake session service and admin/moderator users, and the socket/server mocks (`createMockSocket`, `createMockServer`, `asSocket`, `asServer`). The file went from 596 to 115 lines.

Checks: `pnpm --filter backend test` — 102 suites, 883 tests pass (59s, none of the container timeouts ticket 08 worried about); eslint over `src` clean; `nest build` passes. `tsc --noEmit` still reports the two type errors that predate this work in `answer/__tests__/grading.spec.ts` and `stats/__tests__/stats.service.spec.ts` (not in this diff; not in the build). Status set to `done`.
