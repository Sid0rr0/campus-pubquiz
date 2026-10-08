# Spec: The Live edit module owns the quiz edit, its hold and the live-edit frontier

Status: ready-for-agent

Blocked by: session-write-module

Source: architecture review 2026-10-08, candidate 3. Builds on candidate 1 ([session-write-module](../session-write-module/spec.md)). Independent of candidate 2 ([live-session-changes](../live-session-changes/spec.md)): the two touch different parts of the game state class and can land in either order. Follows **ADR-0002** (live structural edits only after the opened part of the quiz) and doesn't reopen it: progress stays positional.

## Problem Statement

A quiz master can edit a quiz in the editor, or re-import it from a sheet, while sessions are playing it. The Live edit module handles the save:

1. Hold every unfinished session on the quiz.
2. Work out the merged live-edit frontier of the running sessions.
3. Refuse the save with a 409 if it would change anything a live session has reached.
4. Persist the save.
5. Reload each live session's questions, re-grading any already-shown question whose answer key or points were fixed.
6. Deliver every outcome once the hold is released.

Almost none of that lives in the Live edit module. It depends on six members of the game state class:

- "list the live sessions on this quiz",
- "work out one session's live-edit frontier",
- "hold this quiz's sessions",
- a HeldQuizSessions callback object with "apply the quiz edit to this held session",
- "reload this session's quiz" (for a re-import's lobby or ended session),
- "which quiz is this session on".

This causes friction:

- **The live-edit frontier's rules are split in two.** Merging frontiers and checking a save against one live in the shared live-edit frontier module. Working out one session's frontier lives in the game state class, as a method that only reads a session value. The second half of ADR-0002's rules (opened questions keep their place, the current round is the furthest opened one, and when the block counts as having started locking) is far from the first half. The game state class only carries it because it holds the sessions.
- **The quiz edit round-trips through a callback.** The Live edit module asks the game state class to hold the quiz's sessions. The game state class hands back a HeldQuizSessions object, and the Live edit module then calls back into the game state class to apply the edit. The quiz-edit change (reload the rounds, re-grade for the key fix, name the re-scored questions and the teams to sync) is written in the game state class, but nothing except the Live edit module ever triggers it.
- **The test of the save's failure handling mocks those internals.** The spec for "a failing delivery doesn't mask the save's own error" builds a fake game state class with a hand-written hold, list and frontier. Every reshuffle of the game state class breaks it, and it proves nothing about the real hold.
- **The game state class is longer than it needs to be.** About 170 of its lines are live-edit concerns that change only when live-edit rules change.

## Solution

The Live edit module owns everything about saving a quiz while sessions play it:

- It works out which sessions are live and holds the quiz's unfinished sessions itself, through the Session write module.
- It builds the quiz-edit change and applies it through the held writer.
- It reloads a re-import's not-live session through an ordinary session write.
- The live-edit frontier of one session is worked out in the shared live-edit frontier module, beside merging frontiers and checking a save against them. The whole ADR-0002 rule set then lives in one module.

The game state class loses its live-edit members. The Live edit module's own interface (whether a quiz has a live session, the quiz's merged frontier, and save) and its behaviour are unchanged. That includes the 409 refusals, the re-grade on a key fix, the per-team syncs and the delivery order. The quiz master and the room see no difference.

## User Stories

1. As a backend developer, I want everything about saving a quiz during a live session in the Live edit module, so that I read one module to understand a live edit.
2. As a backend developer, I want one session's live-edit frontier worked out beside merging frontiers and checking a save, so that every ADR-0002 rule is in one module.
3. As a backend developer, I want the frontier worked out as a pure function of a session value, so that it can be tested and reused without the game state class.
4. As a backend developer, I want the frontier rule that opened questions keep their place for good, even after Previous steps back, so that the frontier never falls behind the furthest opened question.
5. As a backend developer, I want the current round to stay the round of the furthest opened question when Previous has stepped back before it, so that a round already shown stays frozen.
6. As a backend developer, I want the block to count as having started locking when the status is locking or graded, or when Previous stepped back before the current round, so that a block that may already have locked stays frozen.
7. As a backend developer, I want the Live edit module to hold the quiz's unfinished sessions through the Session write module directly, so that the hold needs no callback through the game state class.
8. As a backend developer, I want lobby sessions held too, so that a session that starts while the save waits is seen as live when the save checks.
9. As a backend developer, I want the live sessions read inside the hold, so that the frontier the save is checked against can't move before it is applied.
10. As a backend developer, I want the quiz-edit change built by the Live edit module, so that the reload and the key-fix re-grade live with the save that causes them.
11. As a backend developer, I want the quiz-edit change applied through the held writer, so that it lands inside the hold and ends in the Session write's commit like every other write.
12. As a backend developer, I want a reload with nothing to re-grade to end in a broadcast, so that the screens show the edited questions.
13. As a backend developer, I want a key fix to name every re-scored question for a fresh admin answer list, so that the grading panel shows the corrected points.
14. As a backend developer, I want a key fix to sync every connected team with an answer to a re-scored question, so that phones show the corrected points.
15. As a backend developer, I want a re-import's lobby or ended session reloaded through an ordinary session write, so that it gets the new rounds without being held.
16. As a backend developer, I want that reload only when the session is still on the re-imported quiz, so that a session switched to another quiz isn't touched.
17. As a backend developer, I want every outcome delivered only after the hold is released, so that delivery never runs while the game can't move.
18. As a backend developer, I want sessions reloaded before a failure still to get their broadcast, so that a failed save doesn't leave screens on the old questions.
19. As a backend developer, I want a failed delivery not to mask the error that failed the save, so that the quiz master sees the real reason.
20. As a backend developer, I want the 409 refusal (with its issues), the 422 for a malformed draft and the 404 for an unknown quiz unchanged, so that the editor's handling doesn't change.
21. As a backend developer, I want the Live edit module no longer to depend on the game state class, so that the dependency between them runs one way.
22. As a backend developer, I want the game state class to lose its live-edit members and the HeldQuizSessions type, so that it holds only live session events, lifecycle and getters.
23. As a backend developer, I want the quiz controller and the import module to keep calling the Live edit module exactly as they do now, so that neither needs an edit.
24. As a backend developer, I want the failing-delivery spec run against the real store, so that it proves the real hold and stops breaking when the game state class changes.
25. As a quiz master, I want saving a quiz during a live session to accept and refuse exactly the same edits as before, so that nothing about live editing changes.
26. As a quiz master, I want a corrected answer key to re-score shown answers exactly as before, so that the leaderboard is right after a fix.
27. As a team on a phone, I want my graded answers to update after a key fix exactly as before, so that I see the corrected points.
28. As a viewer of the big screen, I want the edited questions to appear exactly as before, so that the show isn't affected.

## Implementation Decisions

- **The Session write module becomes a Nest provider.** The game state class and the Live edit module both inject it. This reverses the session-write-module spec's "not a provider in this spec": the Live edit module is now its second caller. Its store and queue stay private, and the change modules from candidate 2 still never receive it.
- **Block grading becomes a Nest provider** so that the Live edit module can run the key-fix re-grade. The game state class and the Move committer use the injected instance instead of constructing their own. It stays stateless, and its interface doesn't change.
- **The live-edit frontier of one session moves to the shared live-edit frontier module**, beside merging frontiers and the round and question editing rules. It becomes a pure function from a session value to its frontier, and its rules are word for word what the game state class does today. The game state class's frontier method is deleted.
- **The Live edit module's dependencies:**
  - the quiz service (unchanged),
  - the gateway, for outcome delivery (unchanged),
  - the Session write module,
  - the seed service, for reloading a session's quiz,
  - block grading.

  It no longer depends on the game state class.
- **The Live edit module's interface is unchanged:** whether a quiz has a live session, the quiz's merged frontier (or none), and save with its optional reload join code and save strategy.
- **What the Live edit module now owns:**
  - **Live sessions:** sessions on the quiz that aren't in the lobby and haven't ended, read from the Session write module's list.
  - **The hold:** every session on the quiz that hasn't ended (lobby sessions included), held through the Session write module's hold.
  - **The quiz-edit change:** a change builder that reloads the session's rounds while keeping its session, join code and progress. When there are questions to re-grade, it re-grades them through block grading. It returns:
    - a plain broadcast when nothing was re-graded,
    - otherwise a broadcast that also names the re-scored questions for the admin answer list and carries a sync for each connected team with an answer to one of them.

    Held live sessions get it through the held writer. A re-import's not-live session gets it through an ordinary session write, after checking (by reading the session) that it is still on the quiz.
- **What leaves the game state class:**
  - quiz edited,
  - the quiz-edit step and the reload helper,
  - applying a quiz edit to a held session,
  - holding a quiz's sessions,
  - listing live sessions,
  - the live-edit frontier,
  - the HeldQuizSessions type.

  "Which quiz is this session on" stays, because the quiz controller uses it.
- **Delivery is unchanged.** Outcomes are collected during the hold and delivered after it is released, through the gateway. On a failed save, the deliveries collected so far are tried with errors logged and swallowed, and the save's error is rethrown.
- **No schema, protocol, REST or shared-type shape change.** The frontier type and the 409 payload are unchanged. The one shared addition is the new pure function.

## Testing Decisions

- **One seam: the real-store harness.** It drives the Live edit module's interface (whether a quiz has a live session, the frontier, save) and the gateway, and asserts on room emits, refusals and the frontier the module returns. This was agreed with the user over keeping a mock-based unit test.
- **A good test here** saves a quiz edit or a re-import, or reads the frontier, through the Live edit module on the real store, then asserts what the rooms received and what was refused. It never mocks the Session write module, the game state class or block grading.
- **The failing-delivery spec moves onto the real-store harness.** Its scenario: two live sessions on one quiz; the second session's quiz reload is made to fail with the hold-next-call helper on the seed service's reload; delivery is made to fail. It asserts that:
  - the save rejects with the reload's own error, not the delivery error,
  - delivery was still attempted for the first session.

  The old mock-based version is deleted.
- **The harness changes how it builds the Live edit module** to match the new constructor. That is test infrastructure, not an assertion change.
- **Specs that must pass without assertion edits:**
  - live-edit, live-structural-edit, live-edit-regrade, quiz-edited, quiz-reimported, opened-questions (which covers the frontier's "started locking" and Previous-stepping-back rules through the Live edit module's frontier),
  - the session-write spec's quiz-edit and re-import cases,
  - the quiz controller and import specs,
  - the live-edit guard spec.
- **No separate unit spec for the moved frontier function.** Opened-questions and live-edit already pin its rules through the Live edit module.
- **Prior art:**
  - the session-write spec's hold-next-call pattern, for making a single call fail or wait,
  - the quiz-reimported spec, for a second session on the same quiz.
- **Done when:**
  - `pnpm test` (all workspaces, since the shared types change), `pnpm typecheck` and `pnpm lint` pass,
  - the Live edit module no longer imports the game state class,
  - the game state class has no live-edit members.

## Out of Scope

- Any change to what a live edit accepts or refuses (ADR-0002), to the save strategy for re-imports, or to the live-edit guard's checks.
- Storing progress by question id (rejected in ADR-0002).
- The per-domain change modules (candidate 2), and the façade-size target in that spec's final ticket.
- Changing the quiz controller's or the import module's use of the Live edit module.
- Changing how outcomes are delivered, or making the Live edit module deliver without the gateway.
- Any behaviour, wording or HTTP status change.

## Further Notes

- `GLOSSARY.md`'s live-edit frontier entry already describes the rules being moved. No glossary change is needed unless implementing them sharpens a term.
- `DOCUMENTATION.md`, `CLAUDE.md`'s Known Tradeoffs (live answer-key fixes) and the `/guide` page need no change, because behaviour is unchanged.
- `docs/architecture.md`: if it shows the live-edit save flow, update it so the Live edit module holds the sessions and applies the quiz-edit change through the Session write module, with no hop through the game state class.
- If this lands before candidate 2's final ticket, that ticket's façade-size target gets easier. If it lands after, it removes the quiz-edit step that candidate 2 left in the façade. Either order works.
