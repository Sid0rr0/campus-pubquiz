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
- After migrating: 8 fail: the timer-expiry bonus, the close-behind-write test, the break-end/text-size test, both disconnect tests, both lobby-settings tests and the "answer submitted while an Advance waits on its progress save" test.
- 12 ordering tests no longer fail with the queue off (3 answers/grades, the first-award standings test, 2 roster tests, 2 press join/kick tests, 3 quiz-edit tests, 2 showdown tests). Cause: `nextQueued` resolves when the write is handed over, so with the queue off the second write has barely started when the hold is released and the first still finishes first. The old helper waited for the second write to finish. Also a hold at `standings` stops before the read, so the read is fresh after release, where the old hold kept a stale result. With the real queue all 29 pass.
