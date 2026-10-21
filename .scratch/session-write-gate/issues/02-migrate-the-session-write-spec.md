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
- [ ] The queue-off check fails the same set of ordering tests before and after the migration (see Comments: it does not, by design of the gate)
- [x] Failure tests still use spies on the failing service
- [x] Backend suite run time is not slower

## Comments

Queue-off check (queue `run` runs its task at once; 29 tests in the spec):

- Before migrating: 20 fail (every ordering test except the cross-session one, the failed-save one and the refused-press one).
- After migrating, first pass: 8 fail. `nextQueued` resolves at hand-over, so with the queue off the second write had barely started when the hold was released.
- Fix: the spec has a local `letRun(write)` that, after `await nextQueued()`, races the second write against 100 macrotask turns before releasing. (The harness `settled` cannot be used: it waits for the queue to go idle and would deadlock behind a held write.) Behind the real queue the write cannot progress, so all 29 pass.
- After the fix, 15 fail with the queue off (timer expiry, close behind write, break end/text size, both disconnects, both lobby settings, answer during Advance, kick during press, three quiz-edit/answered tests, both showdown tests, answered-teams read, ungraded marker).
- 6 ordering tests still pass with the queue off though they failed before: first award, first grade, kick-vs-join, bonus-vs-join (roster), press-vs-join, quiz edit behind a press. Holding the first write at `change` instead of `standings` did not help. Cause: the commit re-reads standings from the database, so the stale result the old hold kept no longer exists; the final state is right even without the queue. Catching these needs a gate step between the standings read and the store (a production gate change), which was not made.
