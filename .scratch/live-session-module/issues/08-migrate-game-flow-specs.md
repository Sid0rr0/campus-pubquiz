# 08: Migrate game-flow specs to the real-store harness

**What to build:** The existing gateway specs about game flow move from the fake-store harness to the real-store harness from 01:
- state transitions and progression
- phase and lock timers
- reveal paging
- closest-guess and showdown reveal
- persistence and restart
- connection/presence
- room scoping
- snapshot leak
- payload validation and logging

Any assertion on internal method calls or their positional arguments is rewritten to assert what rooms and sockets received. Specs keep their intent. This is a migrate batch of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Every game-flow gateway spec runs on the real-store harness and passes.
- [ ] No migrated spec asserts on fake-store call arguments. Assertions are on room/socket emits or on the snapshot.
- [ ] No spec's intent was weakened. Any assertion that couldn't be translated is listed in this ticket's Comments with the reason.
