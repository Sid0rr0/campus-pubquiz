# 09: Migrate grading, answers and team specs to the real-store harness

**What to build:** The existing gateway specs about answers and scoring move to the real-store harness from 01:
- submit
- grading and the grading gate
- leaderboard
- response indicators
- kahoot scoring/timers/answer gate
- live-edit regrade
- team answer sync
- bonus awards
- join/kick/leave
- roster/answer isolation

The concurrent-sessions specs move too, replacing their separate session-aware fake fixture module. Positional-argument assertions (e.g. on the regrade call) become room-visible assertions. This is a migrate batch of the expand–contract. See the spec's Testing Decisions ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Every grading/answers/team gateway spec, including the concurrent-sessions specs, runs on the real-store harness and passes.
- [ ] No migrated spec asserts on fake-store call arguments.
- [ ] Nothing depends on the concurrent-sessions fake fixture module any more.
- [ ] Any assertion that couldn't be translated is listed in this ticket's Comments with the reason.
