# Spec: One room-view projection shared by the server and the frontend fixtures

Status: ready-for-agent

Blocked by: socket-protocol 01 (split socket-events by concept) and socket-protocol 04 (single-room fields in their room view). Both move the view types this spec builds on.

Source: architecture review 2026-10-07, candidate 8 ("Shared room-view projection for the server and frontend fixtures").

## Problem Statement

Each room's view is built on the server by the Screen projection, and it is the only place the rules behind the view live. The frontend's page tests don't use it. Each role has its own fixture helper that takes a hand-written, partial snapshot and fills in the rest, so in effect each helper is a small copy of the server.

- **The fixtures re-implement server rules.** The phone's helper works out answerability with its own copy of the rule: an answering status, not a kahoot question hidden behind the leaderboard, and a round intro only over open questions. The control helper rebuilds Advance and Previous availability from two hand-kept status lists, which stand in for the Move plan. The display helper rebuilds "between kahoot questions". These copies are already simpler than the server. The control helper can't produce a leaderboard reveal or hide step, and the phone's copy guesses a round intro's open questions from whatever block the fixture happened to set. A rule change on the server passes the frontend suite either way, because the frontend tests the copy.
- **The pages are written for fixtures, not for the server.** The server always sends every field of a room's view, but about 45 fields are destructured with fallback defaults in `/display`, `/play` and `/control` (`leaderboard = []`, `roundTitle = ''`, `isAnswerable = false`, `advanceStep ?? 'none'` and so on). They exist so that a test can pass half a snapshot. They hide real gaps: a page that reads a field its room isn't sent renders the default instead of failing.
- **A fixture can describe a state the server never produces.** The fixture is a snapshot, not a quiz and a position in it, so nothing ties `blockQuestions`, `revealQuestions`, `currentQuestion` and `progress` together. A test can show a reveal of a question that isn't in the block, or a players view carrying another room's field, and pass.

None of this has broken on stage. The cost is that the frontend suite's 45 test files can't catch a projection change, and every view field the server adds has a default added in a page to keep old fixtures compiling.

## Solution

The Screen projection moves into shared types, together with the pure rules it reads: the core snapshot, block questions, kahoot visibility, the admin view flags, the Move plan's Advance and Previous descriptions, the reveal-walk trimming, the feedback field and the showdown view. It takes the live session's state and a room, and returns exactly the view that room is sent. The backend's Session write calls it as today, and nothing on the wire changes.

The frontend gets **one fixture builder**. A page test describes a small quiz and where the session is (progress, teams, answers, timers), the builder turns that into session state with sensible defaults, and the shared projection makes the room's view. Page tests receive what the server would send for that state, field for field. The three per-role helpers and their copied rules go away, and so do the pages' fallback defaults.

## User Stories

1. As a developer changing an answerability rule, I want the phone's page tests to see the new rule, so that a change that breaks `/play` fails the frontend suite.
2. As a developer changing the Move plan, I want `/control`'s page tests to get Advance and Previous availability from the real plan, so that the buttons tests check what the server will actually announce.
3. As a developer writing a `/control` test under the leaderboard, I want the fixture to produce reveal and hide steps from the reveal count, so that I don't have to set the step by hand.
4. As a developer writing a `/display` test for a kahoot round, I want "between kahoot questions" to come from the same rule the server uses.
5. As a developer writing a page test, I want to describe a quiz and a position in it, not a snapshot, so that the block, the reveal walk and the current question agree with each other.
6. As a developer writing a page test, I want sensible defaults for everything I don't set (a small quiz, no teams, the lobby), so that a test states only what it exercises.
7. As a developer writing a `/play` test, I want the players view's redaction (hidden kahoot question, reveal walk so far, the ended walk) applied, so that I can't test the phone against an answer it would never receive.
8. As a developer, I want one fixture builder for every role, so that `/display`, `/play` and `/control` tests describe the same session in the same words.
9. As a developer reading a role page, I want it to destructure its view without fallback defaults, so that the page states what its room is sent, not what a fixture forgot.
10. As a developer adding a field to a room's view, I want to add it in the projection only, so that the frontend fixtures pick it up without being edited.
11. As a developer adding a field to a room's view, I want no default added to a page to keep old tests compiling.
12. As a developer, I want a page that reads a field its room isn't sent to fail typecheck, so that the gap shows up before quiz night.
13. As a developer working on the backend, I want the projection's behaviour still pinned by the existing projection specs through the real-store gateway harness, so that moving the code changes nothing it does.
14. As a developer, I want the backend to keep everything that isn't pure (the Session write, Commit a move, the Settle step, timers, database reads) where it is, so that shared types holds rules, not services.
15. As a developer, I want the session state type shared, so that the projection's input is checked the same way on both sides.
16. As a developer, I want production frontend code never to run the projection, so that the server stays the only source of the views on stage.
17. As a quiz master, I want `/display`, `/control`, `/remote` and the phones to behave exactly as before.
18. As a team, I want my phone to receive exactly what it does today, with no answer leaked earlier and no field dropped.
19. As a developer migrating page tests, I want to move one role at a time with the suite green between steps.
20. As a developer, I want the copied status lists and answerability rule gone from the test helpers once every test uses the builder, so that nobody extends them again.

## Implementation Decisions

- **The projection moves into shared types as a pure module.** It exports one entry, *project room view* `(session state, room) → that room's view`, typed per room the way the Screen projection is today, so the players room's call returns the players view and nothing else. Today's name and its room-generic overloads carry over.
- **Its closure moves with it.** These move unchanged: the core snapshot builder, the block-question readers, kahoot visibility, the admin view flags, the closest_guess and showdown reveal step rules, the feedback field, the showdown view, the question view conversions, and the Move plan with its Advance and Previous descriptions. All of them are pure today and only import types from the backend. The showdown "guesses pending" error is plain and moves with the Move plan. The Move plan stays the one source of what a press does: the backend's Commit a move imports it from shared types, so there is still one plan and nothing is duplicated.
- **The session state type moves to shared types**, with the seeded game and seeded round shapes and the roster entry shape it holds, along with the game context reader and the fresh-session factory. Fields that only server bookkeeping reads (connected socket ids, live phase key, banked phase times) stay on the type. The projection reads some of them, and keeping one type avoids a second, almost-identical "projection input". Host notes stay a sibling of the questions, as today, so the conversions still can't spread them into a view.
- **The backend keeps everything stateful.** The Session write, Commit a move, the Settle step, the write queue, timers, grading, standings and every database read stay in the backend and import the moved rules from shared types. The backend's game-state and gateway modules call the shared projection where they call the Screen projection today.
- **Production frontend code doesn't call the projection.** It stays exported from the package root like everything else in shared types. The rule "the frontend renders the view it is sent and never projects one itself; only test fixtures run the projection" goes into `CODING_STANDARDS.md`. No lint rule for now.
- **One fixture builder in the frontend's test support.** It takes a partial description of a session (rounds, with a small default quiz; progress, defaulting to the lobby; teams, answered teams, leaderboard, timers, the showdown, settings) and returns full session state, filling every other field from the fresh-session factory. A *room view* helper runs the projection for a role. The role helpers that also build hook results (the phone's socket result, the admin game result) keep building those but take their snapshot from the builder.
- **Migration is expand–contract.** Expand: add the builder and the room-view helper beside today's helpers. Migrate: page tests move to the builder one role at a time (`/play`, `/display`, `/control` and `/remote`), each batch green on its own. Contract: delete the three per-role view helpers with their copied rules, then remove the pages' fallback defaults, which only partial fixtures needed. Each removal leaves the page destructuring its view as typed.
- **A test that needs a state the real rules can't reach** (if any turn up during migration) sets that one field on the projected view, in the test, and says why in a comment. This should be rare. A test that does it often is a sign the builder needs a better default.
- **No wire, schema, behaviour or migration change.** The views are byte-for-byte what the server sends today.
- **Docs, in the same change:**
  - `DOCUMENTATION.md`'s room-view paragraph names the shared projection in place of the backend file, and says frontend tests build their views through it.
  - `CODING_STANDARDS.md` gains the rule above, plus "page tests build views with the fixture builder, never by hand; pages don't default fields their view always carries".
  - `docs/architecture.md`: module diagrams that place the Screen projection and the Move plan in the backend show them in shared types, used by the backend and by the frontend's fixtures.
  - `GLOSSARY.md`: no domain term changes. Check that the **Move plan** and **Settle step** entries don't say "the backend's".

## Testing Decisions

- **Seams (agreed with the user):** the projection itself, which the existing backend projection specs pin through the real-store gateway harness, and the role pages, which page tests exercise through the fixture builder. No new runtime harness.
- **A good test checks what a room is sent and what a page does with it.** Projection specs assert on the view a room receives after real presses. Page tests assert on what the page renders and sends. Neither asserts which helper computed a field.
- **The backend projection specs pass unchanged** and are the proof that moving the code changed nothing: screen projection, players view (including reveal redaction and the ended walk), admin flags projection, core snapshot, block questions, session snapshot leak, and screen projection delivery. The Move plan's backend specs, Commit a move specs and the shared types game-state tests also pass unchanged.
- **The fixture builder gets a small test of its own in the frontend**: with no input it produces a lobby view for each role, and a description that opens a question produces a players view that is answerable with that question in the block. This pins the defaults the rest of the suite leans on.
- **Page tests migrate without changing what they assert.** A test whose assertion only held because of a copied rule (the clearest risk is a `/control` test under the leaderboard expecting the plain Advance step) is corrected to what the server does, and the ticket notes it.
- **Prior art:** the backend's real-store gateway harness for projection specs, the shared types game-state fixtures for building session-shaped inputs, and the existing per-role helpers for the hook-result shapes that stay.
- The pre-commit hook and CI run `typecheck` across workspaces, which catches a page reading a field its view lacks once the defaults are gone.

## Out of Scope

- Moving single-room fields between views, or splitting the socket-events file. That is the socket-protocol spec, which this builds on.
- Separating block membership from the reveal views (review candidate 6). The block readers move as they are, and that candidate can then reshape them in shared types.
- Using the projection, or the Move plan, in production frontend code (for example an optimistic `/control` preview). Possible later, not part of this.
- Changing any rule in the projection or the Move plan.
- The hook-level tests on the fake socket. They exercise connection and event handling, not views, and keep their payloads as they are.
- Removing fallback defaults in components below the role pages that have a real reason to be optional (media flags, replay tokens).

## Further Notes

- The review counted about 47 defensive defaults. Today the role pages destructure about 45 view fields with a fallback (roughly 20 in `/display`, 10 view fields in `/play` and 5 in `/control`, plus a few `??` fallbacks on the Advance step, the Previous state and the active block start). The page's own hook-result defaults in `/play` (my answers, ratings, seen questions) are not view fields and stay.
- The projection's closure is about 1,200 lines and is already pure, so the move is mostly mechanical. The diff should read as moves plus import changes. A ticket that changes logic while moving it is doing too much.
- Blocking on socket-protocol 01 and 04 avoids two specs moving the same view types and fields at once. If socket-protocol is dropped, this spec can go first, and that spec's ticket 04 then moves fields inside shared types instead.
