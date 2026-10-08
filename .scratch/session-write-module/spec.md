# Spec: The Session write is its own module

Status: ready-for-agent

Blocked by: — (follows session-write and outcome-deadlines, both done)

Source: architecture review 2026-10-08, candidate 1 ("Pull out the Session write module"). Candidate 2 (group the Live session events by domain as change builders) and candidate 3 (move the quiz-edit cluster into the Live edit module) build on this one and are separate specs.

## Problem Statement

The Live session module's main file is about 1,230 lines. It holds every live session event (team joins, answers, grading, bonuses, feedback, showdowns, settings, quiz edits, presses) and also the **Session write**, the single step that every one of those events goes through.

The Session write has the strictest rules in the backend (see `GLOSSARY.md`):

- It runs one write at a time per session.
- It checks against the session as the previous write left it.
- It reads standings last, and keeps the earlier leaderboard if that read fails.
- It reports a moved auto-lock deadline on the outcome, and throws when there is no outcome to carry it.
- It stores nothing when a write throws.

These rules currently live in four private methods of the same class (the queued write, the commit, the store-with-standings step and the deadline report), a few file-level helpers, and two separate helper modules (the per-session queue and the in-memory session store).

This causes friction for anyone working on the module:

- **The core invariant has no home.** Anyone who wants to know "where does a session get stored?" has to search a 1,230-line file. The store is written in four places: the queued write, the held quiz edit, session creation and restart restore. Only the comments say that is the full list.
- **The store and the queue are shallow modules.** Each is a thin wrapper whose rules (when you may write, what to do after) are enforced by its one caller, not by itself. The store's own doc comment says it "writes only through a session write". Nothing in the store makes that true.
- **The held quiz edit duplicates the write.** A save that holds a quiz's sessions applies its edit through a separate private path that calls the commit step directly, outside the queue. That gives two entry points into the commit, kept in step by hand.
- **Event code can reach the store.** Every event method sits in the same class as the store and the commit. Nothing stops a new event from storing a session directly, or from calling another event's public method inside its write. Both break the Session write rules, and `CODING_STANDARDS.md` and comments are the only guards.
- **The file is too long to work in.** Every change to any event means editing the file that also holds the Session write. Splitting the events by domain (the follow-up spec) needs a small interface to the write first.

## Solution

The Session write becomes one module with a small interface. It owns the per-session queue, the in-memory session store, the final standings read, the failed-standings fallback and the deadline report. Nothing else in the backend can store a live session.

The Live session module (the game state class) keeps its public interface exactly as it is: every event method, getter and lifecycle method the gateway, the controllers, the Live edit module and the import module call today. Inside, each event hands its change to the Session write module instead of calling private methods on itself. The held quiz edit goes through the same module, using a write that is valid only inside a hold, so the commit step has one entry point.

Nothing changes for anyone in the room. The quiz master, the big screen and the phones see the same behaviour, the same refusals and the same pushes, in the same order.

## User Stories

1. As a backend developer, I want the Session write in one module, so that I can read every rule about how a live session changes in one place.
2. As a backend developer, I want the session store to be reachable only through the Session write module, so that no new event can store a session outside a write by accident.
3. As a backend developer, I want the per-session queue to be internal to the Session write module, so that callers never queue work that isn't a session write.
4. As a backend developer, I want one entry point into the commit step, so that the queued write and the held quiz edit can't drift apart.
5. As a backend developer, I want the standings read and its failure fallback inside the Session write module, so that a write that changes scores gets fresh standings without the event author doing anything.
6. As a backend developer, I want a write that doesn't change scores to say so with one option, so that the standings read is skipped without a separate code path.
7. As a backend developer, I want the deadline report inside the Session write module, so that every write, held or queued, re-arms the auto-lock timers the same way.
8. As a backend developer, I want a write that moves a deadline without returning an outcome to keep throwing, so that a stale timer can never be left live on stage.
9. As a backend developer, I want a write that throws to store nothing and not hold up the next write, so that a refused event leaves the session as it was.
10. As a backend developer, I want writes to different sessions to keep running in parallel, so that one busy quiz night doesn't slow down another.
11. As a backend developer, I want holding a quiz's sessions to be a Session write module operation, so that the Live edit module's save is checked against sessions that can't move.
12. As a backend developer, I want the write available inside a hold to be valid only while the hold lasts, so that a held session can't be written unqueued after it is released.
13. As a backend developer, I want placing a session (creation and restart restore) to go through the Session write module, so that the store has no setter anyone else can call.
14. As a backend developer, I want closing a session to run on the session's queue, so that a write in progress can't put a closed session back, and a write queued behind the close finds no session.
15. As a backend developer, I want closing a session to keep refusing while the quiz hasn't ended, so that connected screens are never stranded.
16. As a backend developer, I want reading a session to stay synchronous, so that the getters the gateway and controllers call (snapshot, room view, deadlines, admin question context, presenter context) don't become async.
17. As a backend developer, I want reading an unknown join code to keep failing with the unknown-session error, so that a bad join code is reported the same way as today.
18. As a backend developer, I want reading before startup has finished to keep failing with the "used before initialization" error, so that startup-ordering bugs stay easy to spot.
19. As a backend developer, I want to list every session in the store, so that the session picker, the live-session count and the quiz holds can filter them.
20. As a backend developer, I want to wait until a session's queued writes are idle, so that tests can assert after in-flight writes have landed.
21. As a backend developer, I want the game state class to stop holding the store, the queue and the commit, so that what remains is events and getters.
22. As a backend developer, I want the game state class's public interface unchanged, so that the gateway, the controllers, the Live edit module and the import module need no edits.
23. As a backend developer, I want the existing gateway specs to pass unchanged, so that I know the refactor kept every behaviour.
24. As a backend developer, I want the Session write module named after the glossary term, so that `GLOSSARY.md`, the code and the specs use the same word.
25. As an AI agent working in this repo, I want a file under 300 lines that holds the Session write, so that I can load the whole rule set without paging through every event.
26. As a backend developer writing the follow-up spec, I want event changes to need only the Session write module's interface, so that they can move into per-domain modules without any access to the store.
27. As a quiz master, I want Advance, grading, bonuses and kicks to behave exactly as before, so that the refactor is invisible on quiz night.
28. As a team on a phone, I want answers, joins and feedback to be accepted or refused exactly as before, so that nothing about playing changes.
29. As a viewer of the big screen, I want the leaderboard and timers to update exactly as before, so that the show isn't affected.

## Implementation Decisions

- **New module: the Session write module.** It is a plain class composed inside the game state class, the same way the Move committer and block grading are today. It is not a Nest provider. The DI graph doesn't change, and no other module gets a reference to it in this spec. Its dependencies are the Standings service (for the final standings read) and a logger (for the failed-read message).
- **It absorbs the in-memory session store and the per-session queue.** Both become private parts of its implementation. The queue keeps its own spec as an internal seam. The store's "used before initialization" and "unknown join code" errors move with it, with the same messages.
- **Interface, in prose.** A caller needs to know these operations:
  - **write**: takes a join code and a change. The change receives the session as the previous write left it and returns the new session plus an outcome. A not-touching-scores option skips the standings read. It resolves to the change's outcome, with the deadline report attached when a deadline moved.
  - **hold**: takes a set of join codes and a task. While the task runs, every listed session's queue is held. The task receives a held writer, whose write takes the same arguments as the queued write but runs without queueing. The held writer refuses to write any session that isn't in the hold, and refuses all writes once the hold is released.
  - **place**: stores an already-settled session for a join code. Used only by session creation and restart restore, which reach their starting point through the Move committer as today.
  - **remove**: runs on the session's queue and takes a check. The check runs against the session as the previous write left it and may throw to refuse. If it passes, the session is deleted. This is how a session is closed.
  - **read**: synchronously returns the current session for a join code, with the two errors above.
  - **has** and **list**: whether a join code exists, and every stored session.
  - **idle**: resolves once every write queued for a join code has finished.
  - **markInitialized**: called once startup has placed the seeded session.
- **One commit step.** The queued write and the held writer both end in the same private commit inside the module:
  1. Store the session, with fresh standings unless the write said otherwise.
  2. On a failed standings read, log it and keep the earlier leaderboard.
  3. Compare the session as stored with the session the write started from, and attach the deadline report.
  4. Throw if a deadline moved and the change returned no SessionOutcome.
- **Non-reentrancy stays as documented.** A change must not call another public event method of the game state class. This spec doesn't enforce it structurally, because the events still live in that class. The follow-up spec does.
- **What moves out of the game state class:**
  - The queued-write and commit private methods.
  - The store-with-standings step.
  - The deadline-report helpers and the SessionOutcome type guard.
  - The direct store and queue fields.
  - The unqueued path the held quiz edit used to reach the commit.
- **What stays in the game state class:**
  - Every event method and its change, written against **write**.
  - The quiz-edit step, now run through the held writer.
  - The getters, written against **read** and **list**.
  - Session creation and restart restore, which use the Move committer and then **place**.
  - Session close, which uses **remove** with the "not ended" refusal.
  - The not-touching-scores option constant, and the nothing-to-push outcome.
- **The HeldQuizSessions shape the Live edit module receives doesn't change** in this spec. The game state class builds it from the held writer. Moving the quiz-edit cluster into the Live edit module is candidate 3, a separate spec.
- **Naming.** The module is called the Session write module, after the existing `GLOSSARY.md` term. The glossary entry gains one sentence saying that the module owns the store, so a session is never stored any other way.
- **No schema, protocol, socket payload or REST change.**

## Testing Decisions

- **One seam: the gateway, driven through the real-store harness** (the harness in the game tests that boots the gateway against the test database). The refactor is behaviour-preserving, so it is tested by the existing specs passing unchanged, not by new tests of its internals. Agreed with the user over adding a direct test surface for the new module.
- **A good test here** drives a socket event or a controller call through the gateway and asserts what the rooms and sockets receive: snapshots, replies, notices, timer arming. It never asserts on the Session write module, the store or the queue directly.
- **Specs that must pass without edits:**
  - The session-write spec, which covers overlapping writes, held standings reads, a failed standings read, presses with concurrent answers, joins and kicks, timer expiries, quiz edits and re-imports, events that don't touch scores, showdowns, and lobby settings.
  - The outcome-delivery specs (deadlines, order, timers).
  - The live-edit, quiz-edited, quiz-reimported and live-edit-delivery-failure specs.
  - The session-lifecycle-admin and sessions controller specs (create, close, close-blocked).
  - The persistence and quiz-selection spec (restart restore).
  - The update-session-settings spec.
  - The rest of the game gateway specs, about 68 in all.
- **The internal queue spec stays** as an internal-seam test of the queue's ordering and hold semantics, unchanged.
- **No new spec for the "deadline moved without an outcome" throw.** No gateway event can reach it today. The writes whose result isn't a SessionOutcome are:

- a disconnect from a socket that held no team,
- a lobby settings change,
- a team join, which returns the team alongside its outcome.

None of them moves a deadline. It stays a defensive check carried over unchanged.
- **Optional new gateway-level check, only if cheap.** Releasing a hold and then calling its held writer is refused. If the Live edit module can't reach this through the gateway, skip it: it then becomes a rule of the module's interface that its type and doc comment enforce.
- **Prior art:** the session-write spec and its hold-next-call helper (for holding a standings read or a save mid-write), and the live-edit-delivery-failure spec (for hold and release).
- **Done when:**
  - `pnpm --filter backend test` passes.
  - `pnpm typecheck` and `pnpm lint` pass.
  - The game state file is roughly 1,000 lines or less, and the new module is under 300.

## Out of Scope

- Moving event changes into per-domain change modules (candidate 2). That is the follow-up spec, and it is what takes the game state class down to a façade.
- Moving the quiz-edit step, the quiz hold, the live-session list and the live-edit frontier into the Live edit module (candidate 3).
- Making the Session write module a Nest provider, or injecting it anywhere else.
- Deleting the two deadline getters that only tests call (question lock time and kahoot question end time).
- Any change to the Move committer, block grading, the Settle step or outcome delivery.
- Any behaviour change, including error messages, refusal wording or log text.
- Horizontal scaling or a shared store. One backend instance stays (see `CLAUDE.md`).

## Further Notes

- `GLOSSARY.md`'s Session write entry already describes the module's behaviour. Keep it current: add the one sentence about owning the store, and change nothing else.
- `DOCUMENTATION.md` and the `/guide` page need no change, because nothing a moderator sees or does changes.
- `docs/architecture.md`: if it has a diagram of the game state internals, update it to show the Session write module owning the store and queue.
- The build quirk recorded in the game state class (its logger name is a string literal, because `nest build` crashes on a self-reference there) may apply to the new module too. Use a string-literal logger name there as well.
