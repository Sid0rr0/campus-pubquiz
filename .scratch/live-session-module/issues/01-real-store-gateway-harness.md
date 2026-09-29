# 01: Real-store gateway test harness (expand)

**What to build:** A second gateway test harness that drives socket events exactly like the existing one (mock server/sockets, captured room emits). Behind it are the real answer, team, bonus and showdown modules on a Postgres testcontainer, instead of the fake answer store that returns the same data on every call. It sits beside the existing harness so no current spec changes. It proves a real game can be played through the gateway and its derived state observed in what rooms receive. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A harness helper builds a gateway wired to real answer/team/bonus/showdown modules on a Postgres testcontainer, with migrations applied.
- [ ] One container per spec file, with game tables truncated between tests, following the existing answer/team/stats testcontainer prior art.
- [ ] Seeding a playable quiz (at least one breakAfter round with multiple_choice, free_text, closest_guess and match questions) and a joined team is one helper call.
- [ ] A smoke spec plays admin START_QUIZ → ADVANCE to the first question → team joins and submits → admin grades. It asserts on what the admin/display/players rooms received, not on internal calls.
- [ ] The existing fake-store harness and every existing spec are untouched and still pass.
