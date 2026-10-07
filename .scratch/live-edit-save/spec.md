# Spec: A live quiz save is checked and applied inside the live sessions' writes

Status: ready-for-agent

Blocked by: — (follows live-structural-edits and session-write, both done)

## Problem Statement

ADR 0002 lets the quiz master edit a quiz while it's being played, but only the part no live session has opened yet. The save is checked against the **live-edit frontier**, and a save that would shift a saved position is refused with a 409. That promise has two holes, and the rules for it are spread over several modules:

- **A save can slip past the frontier.** The save path reads the frontier from the live sessions, checks the draft against it, saves the quiz, and only then asks each session to reload. None of that runs inside the sessions' **session writes**. A press that opens a question in between isn't seen by the check. Example: the quiz master deletes or moves the next question while someone presses Advance on `/remote`. The check passes against the old frontier, the question opens on the big screen, and the save then removes it from under the session. Progress is positional, so the session is now pointing at a different question than the one teams are answering.
- **A re-import ignores other sessions.** Re-importing a sheet only checks that the importing session is in the lobby or has ended. If another session is live on the same quiz, the re-import replaces that quiz's rounds and questions with no frontier check at all.
- **One rule, many homes.** The frontier is worked out in the Live session module, merged and checked in the quiz controller, enforced by the guard, and applied through the gateway (the controller calls the socket layer to reach the sessions). The re-import calls the gateway too. The editor works out each round's permissions itself from separate helpers, in the editor panel, the outline and the draft state: whether the round has been reached, whether its structure is frozen, how many questions are pinned, which rounds a question can move to, and the note to show. The guard builds the same answers its own way.
- **The tests can't see the race.** The quiz controller's tests mock the Live session module and the gateway, so a save racing a press can't be expressed there, and the real-store tests don't save through the controller's path.

## Solution

Every save of a quiz that has live sessions, whether from the editor or a re-import, goes through one **Live edit module**. It holds the session write of every live session on that quiz while it:

1. reads their frontier;
2. checks the save against it;
3. saves the quiz;
4. reloads each session, regrading any opened question whose answer or points changed.

Nothing can open a question between the check and the reload, so a save is either applied with every session still behind the frontier it was checked against, or refused with the same 409 and issues the editor already shows. The editor and the backend's guard read each round's permissions from one shared description, so they can't disagree about what may change.

For the quiz master nothing looks different, except that a save made at the moment the quiz moves on is refused cleanly instead of quietly changing a question that's on air.

## User Stories

1. As a quiz master, I want a save that deletes or moves the next question to be refused if that question opens at the same moment, so that the big screen and the phones never end up on a different question.
2. As a quiz master, I want a refused save to show the same issue list as today, so that I know what to change and reload.
3. As a quiz master, I want a save that's still allowed to land even while the quiz is moving, so that I can keep fixing later rounds during a live game.
4. As a quiz master fixing an answer key on an opened question, I want the regrade to run against the session as it is when the save lands, so that answers graded at that moment are treated consistently.
5. As a quiz master running two sessions on the same quiz, I want a save checked against both sessions at once, so that neither can move past the frontier during the save.
6. As a quiz master, I want my save not to hold up another session that's playing a different quiz, so that unrelated games aren't slowed.
7. As a quiz master, I want a re-import onto a quiz another session is playing to be refused when it would change that session's opened part, so that importing never breaks a live game.
8. As a quiz master, I want a re-import that only changes the unopened part of a quiz to be allowed and broadcast like an editor save, so that both ways of editing behave the same.
9. As a quiz master, I want the editor to offer exactly the edits the server will accept for each round, so that I don't build a change only to see it refused.
10. As a quiz master, I want each reached round in the editor to show why it's locked (reached, or its block started locking), so that I know where to add new questions.
11. As a quiz master, I want the "move to round" choices to list only rounds that can take the question, so that I can't pick a frozen round.
12. As a quiz master, I want the outline and the round editor to agree on which rounds are reached and how many questions are pinned, so that the editor reads as one view.
13. As a team, I want the question on my phone to stay the question the big screen shows through any edit, so that our answer is to the question we saw.
14. As a team, I want our existing answers to an opened question to keep their place through a save, so that we never lose an answer to an edit.
15. As a quiz master, I want a save during the break or reveal to be checked the same way, so that a block that has locked stays frozen.
16. As a quiz master, I want a save to a quiz with no live session to save exactly as it does today, so that offline editing is unaffected.
17. As a developer, I want one module that saves a quiz while it's live, so that the editor and the re-import can't drift apart.
18. As a developer, I want the quiz controller to only translate HTTP to and from the Live edit module, so that the controller holds no game rules and no socket calls.
19. As a developer, I want one shared description of each round's editing permissions, so that the editor and the guard are built on the same answers.
20. As a developer, I want the save-vs-press race pinned by real-store tests, so that a regression shows up in CI, not on stage.

## Implementation Decisions

- **The Live edit module lives in the game area,** beside the Live session module and outcome delivery, because it needs both. Its interface is one operation: _save this quiz's rounds and title, given the quiz id_. It returns the save result or throws the existing live-edit refusal (mapped to 409 with its issues) or the existing draft-invalid and not-found errors (422 and 404). With no live session on the quiz it's a plain save. The quiz controller's update and the re-import both call it, and neither calls the gateway any more. The gateway's "quiz edited" notification is removed once nothing calls it.
- **Holding several sessions at once.** The session write queue gains a way to run one step while holding the queues of several join codes. It takes them in a fixed order (sorted by join code), so two overlapping saves on the same sessions can't deadlock. Writes to sessions outside the set are unaffected. Inside that step, the Live edit module:
  - reads each held session's frontier and merges them, with the same merge rule as today;
  - checks the incoming rounds against the persisted ones;
  - saves;
  - for each session, reloads the quiz, regrades the opened questions whose answer or points changed, reads standings, and stores the session.

  Outcomes are delivered after all queues are released, as with every session write.

- **Which sessions are live** (running, so not lobby and not ended) is decided inside the held step, not before it. A session that starts or ends during the save is therefore counted the way it stands when the check runs. A session that enters the lobby on this quiz while the save waits is not live, and just reloads on its next event, as today.
- **The Live session module's quiz edit event splits** into a step that takes a session and returns the reloaded and regraded session plus its outcome, which the Live edit module runs inside the held writes. Its frontier reader takes a session instead of a join code. Public event methods stay non-re-entrant.
- **The re-import goes through the Live edit module** when the imported quiz has live sessions. The importing session's own lobby-or-ended rule stays. A re-import onto a quiz another session is playing is checked against that session's frontier like an editor save. The broadcast for the importing session's lobby or ended screens still happens, through the same outcome.
- **Shared round-editing description.** The shared types gain one function that, given the frontier and the rounds, describes each round:
  - whether a live session has reached it (it keeps its place, break-after and kahoot setting, and can't be deleted);
  - its structure editing (frozen, after-opened or free);
  - how many questions at its start are pinned;
  - whether it can take a question moved from another round;
  - why it's locked, if it is: reached, or its block has started locking.

  The editor panel, the outline and the draft state read it instead of combining the separate helpers. The backend guard builds its checks on the same description; its issue messages and 409 shape are unchanged. The lower-level helpers stay internal to the shared types if nothing else uses them.

- **ADR 0002 stands:** progress stays positional. This spec makes its "a save after the game moved on is refused" promise hold even when the move happens during the save.
- **No schema, protocol or payload changes.** The draft response keeps its live-edit frontier field. The editor's issue rendering is unchanged.
- **Docs, in the same change:**
  - `GLOSSARY.md`'s **Live-edit frontier** entry gains "checked and applied while the live sessions are held, so the game can't move past it during a save".
  - `DOCUMENTATION.md`'s live-edit section says the same, and adds that a re-import onto a quiz another session is playing is checked the same way.
  - The `/guide` page gains one line: a save made just as the quiz moves on may be refused, and the quiz master reloads.

## Testing Decisions

- **A good test asserts what the quiz master and the rooms see:** the save's result or its 409 issues, the snapshots and question views the admin, display and players rooms receive, and the quiz as reloaded. Don't assert which queue was held, call order, or which internal helper ran.
- **Seam 1 (new): the Live edit module, through the real-store gateway harness.** Saves are made through the module's save operation, the same one the controller calls. Overlaps are forced with `holdNextCall` and `nextWriteWaiting`.
  - Written first, failing against today's code: a save that deletes the next unopened question, overlapped with an Advance that opens that question (the press held on its progress save), is refused with the existing "add it after the last opened one" style issue. The session's on-air question is unchanged.
  - The reverse order: the save lands first, then the Advance opens the question that follows.
  - A save allowed by the frontier during a press lands, and the session carries on from the same opened question.
  - An answer-key fix on an opened question regrades consistently while a grade lands at the same moment.
  - Two sessions live on one quiz: a save is checked against both, and one session's held press holds the save.
  - A session on another quiz isn't held up by the save.
  - A re-import from a lobby session onto a quiz another session is playing is refused when it would change the opened part, and allowed (and broadcast) when it doesn't.
- **Seam 2 (new, pure): the shared round-editing description.** Table tests over frontiers: before any open, mid-round, the current block locking, stepped back with Previous, and two merged sessions. Each round's reached, structure editing, pinned count, move-target eligibility and reason are asserted. The existing guard spec stays green unchanged, as the check that the guard still refuses exactly what it refused before.
- **Seam 3 (existing): the quiz editor panel, outline and draft state tests.** Their assertions stay. They now exercise the shared description through the editor.
- **The quiz controller's spec shrinks** to HTTP mapping (409, 422 and 404 from the module's errors), and its mocked game state goes. `live-structural-edit.spec.ts`, `quiz-edited.spec.ts`, `quiz-reimported.spec.ts`, `live-edit-regrade.spec.ts` and `opened-questions.spec.ts` pass, moved to save through the Live edit module where they used the controller or gateway path.
- **Prior art:** `session-write.spec.ts` for overlap with `holdNextCall`; `live-structural-edit.spec.ts` and `live-edit-regrade.spec.ts` for saving a live quiz and checking where the session carries on; `live-edit-frontier.test.ts` for pure frontier tables; `session-write-queue.spec.ts` for queue behaviour, extended for holding several join codes.

## Out of Scope

- Storing progress by question id instead of position. ADR 0002 rejected that.
- Merging concurrent editor saves (two people editing the same quiz). Last save wins as today; the frontier check only protects live sessions.
- Validating the draft in the editor before saving, beyond what the shared description already lets it disable. The 409 remains the authority.
- Team event gates (the team-event-gates spec) and the question answer kinds (the question-answer-kinds spec).
- Deleting a quiz with a live session, which is already refused outright.

## Further Notes

- Source: candidate 3 ("One Live edit module across the frontier check, save and reload") of the architecture review dated 2026-10-07. It's the same kind of fix as team-event-gates: a check and a database write that sat in front of the session write move inside it.
- The re-import gap is read from the code (the import checks only its own session's status and finds the quiz by title). Pin it with a failing test before changing it.
- Holding several queues is the one change to the session write queue's interface. If a session's write is slow, the save waits for it. At pub-quiz scale (one or two sessions per quiz) that's accepted.
- Suggested order:
  1. The shared round-editing description, with the editor reading it (pure, no backend change).
  2. The queue's hold-several step.
  3. The Live edit module with the failing race test, the controller moved onto it, and the gateway notification kept only for the re-import.
  4. The re-import through the module, with the gateway notification removed.
  5. Docs and the `/guide` line.

  Each step leaves the suite green.
