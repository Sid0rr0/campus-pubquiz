# 02: Migrate the session-write spec onto the gate

**What to build:** The session-write spec (the largest set of ordering tests) forces its overlaps through the Write gate instead of holding services and swapping the private queue's run method. Its tests keep their names, events and assertions.

Each held service becomes a hold on the step it stands in for:

- the progress save, team join, roster removal, answer submit, answered-teams read, settings save and the quiz reload inside a held write → **`change`**
- the standings read → **`standings`**

Every `nextWriteWaiting()` becomes `nextQueued()`. Failure tests (a standings read that rejects, a save that throws) keep their jest spies.

Before migrating, temporarily make the Session write skip its queue (run each write at once) and note which ordering tests in this file fail. After migrating, the same tests must fail under the same change. Revert the change afterwards; this is a manual check, not a committed test.

See the spec's "Migrating the specs".

**Blocked by:** 01 (The Write gate and the test gate)

**Status:** ready-for-agent

- [ ] No `holdNextCall` or `nextWriteWaiting` left in the session-write spec
- [ ] Every test keeps its name and assertions, and passes
- [ ] The queue-off check fails the same set of ordering tests before and after the migration (listed in the commit message or the ticket's Comments)
- [ ] Failure tests still use spies on the failing service
- [ ] Backend suite run time is not slower
