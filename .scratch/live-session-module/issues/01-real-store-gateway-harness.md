# 01: Real-store gateway test harness (expand)

**What to build:** A second gateway test harness that drives socket events exactly like the existing one (mock server/sockets, captured room emits). Behind it are the real answer, team, bonus and showdown modules on a Postgres testcontainer, instead of the fake answer store that returns the same data on every call. It sits beside the existing harness so no current spec changes. It proves a real game can be played through the gateway and its derived state observed in what rooms receive. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [x] A harness helper builds a gateway wired to real answer/team/bonus/showdown modules on a Postgres testcontainer, with migrations applied.
- [x] One container per spec file, with game tables truncated between tests, following the existing answer/team/stats testcontainer prior art.
- [x] Seeding a playable quiz (at least one breakAfter round with multiple_choice, free_text, closest_guess and match questions) and a joined team is one helper call.
- [x] A smoke spec plays admin START_QUIZ → ADVANCE to the first question → team joins and submits → admin grades. It asserts on what the admin/display/players rooms received, not on internal calls.
- [x] The existing fake-store harness and every existing spec are untouched and still pass.

## Comments

Implemented in `e9af2e9` (`apps/backend/src/game/__tests__/real-store-test-utils.ts`, `real-store-smoke.spec.ts`). `createGateway({ teamNames })` seeds the quiz and joins teams in one call. The smoke spec asserts on room-visible emits (admin answer list, team `ANSWER_RECEIVED`, state update to all three rooms). Full backend suite passed (96 suites, 851 tests) before the final `createGateway({ teamNames })` tweak; lint, tsc and the smoke spec were re-run after it. Status left as `ready-for-agent`: the triage vocabulary has no done state.
