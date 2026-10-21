# 02: Migrate the session-write spec onto the gate

**What to build:** The session-write spec (the largest set of ordering tests) forces its overlaps through the Write gate instead of holding services and swapping the private queue's run method. Its tests keep their names, events and assertions.

Each held service becomes a hold on the step it stands in for:

- the progress save, team join, roster removal, answer submit, answered-teams read, settings save and the quiz reload inside a held write → **`change`**
- the standings read → **`standings`**

Every `nextWriteWaiting()` becomes `nextQueued()`. Failure tests (a standings read that rejects, a save that throws) keep their jest spies.

Before migrating, temporarily make the Session write skip its queue (run each write at once) and note which ordering tests in this file fail. After migrating, the same tests must fail under the same change. Revert the change afterwards; this is a manual check, not a committed test.

See the spec's "Migrating the specs".

**Blocked by:** 01 (The Write gate and the test gate)

**Status:** done

- [x] No `holdNextCall` or `nextWriteWaiting` left in the session-write spec
- [x] Every test keeps its name and assertions, and passes
- [ ] The queue-off check fails the same set of ordering tests before and after the migration (not met: 17 of 29 fail with the queue off, against 20 before; see Comments)
- [x] Failure tests still use spies on the failing service
- [x] Backend suite run time is not slower

## Comments

Queue-off check (queue `run` runs its task at once; 29 tests in the spec):

- Before migrating: 20 fail (every ordering test except the cross-session one, the failed-save one and the refused-press one).
- After migrating, first pass: 8 fail. `nextQueued` resolves at hand-over, so with the queue off the second write had barely started when the hold was released.
- Fix: the harness `letOthersRun()` (timing-based: 100 `setImmediate` turns) runs after `await nextQueued()` and before releasing. The harness `settled` cannot be used: it waits for the queue to go idle and would deadlock behind a held write. Behind the real queue the write cannot progress, so all 29 pass.
- Measured outcome: 17 of 29 fail with the queue off, against 20 before the migration. The check is not met.
- 6 ordering tests (roughly the earlier list: first award, first grade, kick-vs-join, bonus-vs-join, press-vs-join, quiz edit behind a press) are not caught because standings is held before the read: the commit re-reads standings from the database, so the stale result the old hold kept no longer exists and the final state is right even without the queue. Catching them would need a gate step between the standings read and the store (a production gate change), which was deliberately not added.
