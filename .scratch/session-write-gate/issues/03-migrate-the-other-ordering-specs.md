# 03: Migrate the other ordering specs onto the gate

**What to build:** Every other spec that forces an overlap does it through the Write gate. That covers the grade-and-bonus write, last-second answer, join/leave/kick order, feedback write gates, showdown write and Live edit specs. The two specs that cast the game state service to reach its private Session write read it from the harness instead. The tests keep their names, events and assertions.

Each held service becomes a hold on the step it stands in for:

- the progress save, answer submit, team join, round rating, showdown guess, ungraded read and the quiz reload inside a held write → **`change`**
- the standings read → **`standings`**
- the Live edit's quiz save, which runs inside its queue hold but outside any single write → **`hold`**

Every `nextWriteWaiting()` becomes `nextQueued()`. The `rejectNthCall` on a failing reload and other failure spies stay.

Run the same queue-off check as ticket 02: temporarily make the Session write skip its queue, and confirm that the same ordering tests fail before and after the migration.

See the spec's "Migrating the specs".

**Blocked by:** 01 (The Write gate and the test gate)

**Status:** done

- [ ] No `holdNextCall` or `nextWriteWaiting` left in any of the six spec files
- [ ] No spec casts the game state service to reach its Session write (action-availability and real-store-smoke use the harness's)
- [ ] Every test keeps its name and assertions, and passes
- [ ] The queue-off check fails the same set of ordering tests before and after the migration (listed in the commit message or the ticket's Comments)
- [ ] `rejectNthCall` and the failure spies are untouched
