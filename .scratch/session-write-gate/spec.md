# Spec: A Write gate on the Session write

Status: ready-for-agent

Blocked by: — (follows real-store-harness-module and session-write-module, both done)

Source: architecture review 2026-10-20 ("Out of Scope, revisited"), candidate 2 ("Strong", local-substitutable). It picks up both Out of Scope items from `real-store-harness-module`.

## Problem Statement

The **Session write** is what keeps a live session correct when two things happen at once: an answer lands during a press, a grade during a quiz edit, a join during a kick. The specs that prove this force two events to overlap. They do it by reaching past the module's interface.

- A spec holds open "the next call" to whichever collaborator the first event happens to await, by replacing that method on the service object for one call. There are 43 such holds across seven spec files: the progress save (17), the standings read (12) and eleven other services (14).
- A spec learns that the second event is waiting its turn by swapping the private queue's run method inside the harness (the `nextWriteWaiting` helper, used about 44 times). It reaches the queue through casts to the game state service's and the Session write's private fields.
- Two more specs cast the game state service to reach its private Session write.

This costs the developer in three ways:

- **Renames break at runtime, not compile time.** Method names are passed as strings and private fields are reached through casts, so renaming a collaborator method or a private field compiles and then fails, or worse, quietly stops holding anything.
- **Tests encode internals.** "Hold the progress save" is a fact about how a press is implemented today. Move the save, add another await before it, or split the change, and a test about _ordering_ breaks, or stops testing what its name says.
- **The waiting signal is timing-based.** `nextWriteWaiting` waits one macrotask and infers "this write is queued behind another" from whether it has started yet. It depends on the queue's chain being microtasks only.

## Solution

The Session write takes a **Write gate**: an injected collaborator it reports to at a few named steps of every write. In production the gate passes straight through and costs nothing. In the real-store harness a test gate lets a spec say, in the module's own terms, "hold the next write once its change has run", "hold it before its standings read", or "tell me when the next write has been queued". The spec doesn't need to know which collaborator that write awaits.

Specs keep driving events through the gateway and asserting on what clients receive. Only the way they force an overlap changes. The collaborator holds and the queue swap go. Collaborator _failure_ patches stay as jest spies, because those tests are about how one collaborator's failure is handled.

Users see no change.

## User Stories

1. As a developer, I want to hold a session write at a named step, so that I can force two events to overlap without knowing which service the first one awaits.
2. As a developer, I want "hold the next write once its change has run" to work for a press, an answer, a grade, a join, a kick, a rating, a showdown guess, a settings change and a quiz reload alike, so that every ordering test is written the same way.
3. As a developer, I want "hold the next write before its standings read", so that I can prove a write's leaderboard is never overwritten by an older one.
4. As a developer, I want to hold a Live edit save once it owns its sessions' queues, so that I can queue a press behind a quiz save without holding the quiz service.
5. As a developer, I want to know when the next write has been handed to a session's queue, so that I can release a held write only after the second event is waiting, without sleeping or guessing from timing.
6. As a developer, I want a hold to apply to one join code when I name one, so that multi-session tests can hold one session while another runs freely.
7. As a developer, I want a hold to apply to only the next write that reaches the step, so that later writes, including the second event under test, pass straight through.
8. As a developer, I want a held write to resume exactly where it stopped when I release it, so that the rest of its work (storing, reporting deadlines, reading standings) runs as in production.
9. As a developer, I want a hold I forget to release to be released when the test ends, so that a failing test doesn't hang the suite.
10. As a developer, I want a hold at a step the next write never reaches (a write that skips the standings read, for example) to fail the test with a clear message rather than hang, so that a wrong hold is obvious.
11. As a developer, I want renaming a gate step to fail at compile time in every spec that uses it, so that the tests can't silently stop holding anything.
12. As a developer, I want renaming a collaborator's method to no longer break any ordering test, so that refactoring a service is safe.
13. As a developer, I want moving the progress save to a different point inside a press to leave ordering tests alone, so that the tests check ordering, not implementation.
14. As a developer, I want the production gate to do nothing and add no measurable cost, so that live writes aren't slowed down.
15. As a developer, I want the gate to see writes made through a Live edit hold as well as queued writes, so that quiz-edit ordering tests use the same tool.
16. As a developer, I want specs that need the Session write itself to get it from the harness, so that no spec casts the game state service to reach a private field.
17. As a developer, I want tests of a collaborator's failure (a progress save that throws, a standings read that fails, a reload that fails) to keep using jest spies on that collaborator, so that they still prove how that specific failure is handled.
18. As a developer, I want every ordering spec to keep its current name and assertion, so that the move to the gate is reviewable as a mechanical change.
19. As a developer, I want the gate's behaviour covered by its own small spec, so that the timing tool the other specs rely on is itself proven.
20. As a developer, I want the harness's documentation to explain how to force an overlap with the gate, so that the next ordering test is written the new way.
21. As a developer working on `live-session-rest`, I want its ordering test (a bonus edit queued behind a held write) to be expressible with the gate, so that the new REST path is tested the same way as socket events.

## Implementation Decisions

### The Write gate

- A new interface in the live session module, the **Write gate**, with two operations the Session write calls:
  - **queued(joinCode)**: a write (queued or held) has been handed over for this join code. It is synchronous and returns nothing.
  - **reached(step, joinCode)**: a write has reached a named step. It returns a promise the Session write awaits before carrying on.
- Three named steps, a string-literal union so that a rename fails at compile time:
  - **`hold`**: a Live edit hold now owns every queue it asked for and is about to run its task. It is reported once per hold, for each join code in it.
  - **`change`**: a write's change has returned (its database work is done) and nothing has been stored yet. Queued writes and held writes both reach it.
  - **`standings`**: a write that reads standings is about to run its live results read. A write that opts out of the standings read never reaches it.
- The Session write gets the gate through a Nest provider token, the same pattern as the phase timer schedulers: optional injection, defaulting to a pass-through gate whose `reached` resolves at once. The game module doesn't provide the token in production.
- The queue itself is unchanged. The gate sits in the Session write's own steps (hand-over, hold start, after the change, before the live results read), so the queue's ordering guarantee is still the thing under test.
- The `remove` used by session close reports `queued` but no step. No spec needs to hold a close.

### The test gate

- The real-store harness provides the token with a test gate. Nothing else in the harness changes, and the gateway, game state service and broadcaster are still the real ones.
- What a spec can do with it:
  - **holdAt(step, { joinCode? })** returns a held write: a `reached` promise (the write is now stopped at that step) and `release()`. It catches the next write to reach that step, for that join code if one is given. Later writes pass through.
  - **nextQueued({ joinCode? })** returns a promise that resolves when the next write is handed over (for that join code if given). It replaces `nextWriteWaiting`, and it resolves when the write is queued, with no timing inference. The queue is first-in first-out, so a write queued while another is held is waiting behind it.
- At the end of each test, the harness releases every outstanding hold and fails the test if a `holdAt` was never reached. A hold for a step the write skips (for example `standings` on a disconnect) is therefore a clear failure, not a hang.
- The harness exposes the Session write provider it already builds, so the two specs that cast the game state service to reach it read it from the harness instead.

### Migrating the specs

- Each of the 43 collaborator holds becomes a gate hold on the step it stands in for:
  - the progress save, team join, roster removal, answer submit, answered-teams read, ungraded read, round rating, showdown guess, settings save and the quiz reload inside a held write → **`change`**
  - the standings read → **`standings`**
  - the quiz save inside a Live edit hold → **`hold`**
- Every `nextWriteWaiting()` becomes `nextQueued()`.
- Each spec keeps its name, its events and its assertions. Where a spec's name names the collaborator ("waits on its save", "the first award's standings read finishes last"), the name stays. It still describes the behaviour, since a held change is a save that hasn't finished.
- `holdNextCall` and the private queue swap are deleted once nothing uses them. `rejectNthCall` and the jest spies that make a collaborator throw stay.

### Docs

- The harness's own doc comments (`settled`, `nextQueued`, the gate) describe how to force an overlap. No `GLOSSARY.md` entry: the Write gate is a test seam, not a domain term. `docs/architecture.md` gets one line on the gate where it describes the Session write, if it lists the module's collaborators.

## Testing Decisions

- A good test drives events through the gateway (or the Live edit service, or the REST entry once `live-session-rest` lands) and asserts on what clients received and what was stored. The gate only decides _when_ a write proceeds. Tests never assert that a gate step was reached as the thing under test, except in the gate's own spec.
- **One seam: the Write gate**, used through the real-store harness. No new harness, and no in-memory database.
- The test gate gets its own spec through the real-store harness:
  - holding at `change` stops a press before its session is stored (the snapshot is unchanged), and release finishes it
  - holding at `standings` stops a bonus award after its change, before its leaderboard changes
  - a `joinCode` filter lets another session's write pass
  - `nextQueued` resolves for a write queued behind a held one
  - an unreached hold fails the test at teardown
  - holding at `hold` stops a Live edit save before its quiz is saved
- Every migrated spec must still fail when the behaviour it guards is broken. To check this, before migrating, temporarily make the Session write skip the queue (run each write at once) and confirm that each ordering spec in the session-write, grade-and-bonus, last-second-answer, join-leave-kick-order, feedback, showdown and live-edit files fails. Then repeat the check after migrating. This is a manual check during implementation, not a committed test.
- Prior art: the phase timer schedulers token and the manual timer scheduler (an injected test adapter provided by the harness). The session-write spec (the largest set of ordering tests). The session write queue's own unit spec.
- The backend suite's run time must not get slower (see `backend-test-speed`). The gate removes a `setImmediate` per watched write, so it should not.

## Out of Scope

- **Failure injection at a step** (`failAt`). Failure tests keep their jest spies on the failing collaborator, because they test that collaborator's handling: the live results read keeping a figure's earlier value, a failed save leaving the session where it was, a failed reload being logged.
- **Changing the queue**, the Session write's ordering rules, or anything a user sees.
- **The ~116 other `as unknown as` casts in specs** (mock sockets, seeded question ids, partial payloads). Only the casts that reach the Session write's privates go.
- **Phase timers**. They already have their own injected scheduler seam.
- **Frontend and shared-types tests.**

## Further Notes

- `live-session-rest` (bonus edits inside the Session write) has an ordering test that its spec writes with today's hold helper. Whichever spec lands second writes or moves that test onto the gate. `live-session-rest` ticket 04 also changes the Session write's commit step, where the `change` and `standings` steps sit, so the second to land rebases. Neither spec blocks the other.
- Counts are as of 2026-10-20: 43 collaborator holds across 7 spec files, of which 22 are in the session-write spec; about 44 `nextWriteWaiting` uses; and 1 `rejectNthCall`. The architecture review quoted 56 and 47; the difference is in how multi-line call sites were counted.
