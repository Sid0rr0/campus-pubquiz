# Spec: Every session holds the current quiz, and grading reads only that copy

Status: ready-for-agent

Source: architecture review 2026-10-14, candidate 2 ("Strong", local-substitutable).

## Problem Statement

Each session holds its own copy of the quiz's rounds and questions (its seeded game). The big screen, the phones, the Block module, the Settle step and most grading read that copy. But two things in grading read the database instead, and one kind of session is never told about quiz edits:

- **A quiz save from the editor doesn't reach sessions in the lobby.** The Live edit save holds every unfinished session on the quiz, lobby sessions included, but reloads only the running ones. A re-import reloads its own lobby session; the editor's save reloads none. Nothing reloads a session when Start quiz is pressed either. A session created before the edit keeps the old rounds until a backend restart happens to reload it.
- **Submit and hand grading read the question from the database.** Submitting an answer re-reads the question row and builds its Answer key from it. Grading an answer by hand loads the question from the answer row. Grading at the lock, kahoot speed scoring and key-fix regrades all use the session's copy instead.

What a quiz master can run into: they create a session, open the lobby so teams can join, notice a mistake and fix it in the quiz editor, then press Start quiz.

- If they **corrected an answer**, the big screen and the reveal show the old answer. Submits are graded against the new one, while lock-time grading, kahoot speed scoring and closest_guess batch grading use the old one. The same team can be marked against two different keys in one round.
- If they **added a question**, the session never shows it.
- If they **deleted a question**, the session still opens it, and every team's answer to it fails, because the question row is gone.
- If they **reordered or renamed rounds**, the round overview and round intros show the old order and titles.

These problems last until the backend restarts.

For a developer:

- "Which question does grading use?" has two answers, and the Grading policy's key-fix rule (was this grade given automatically under the old key?) quietly assumes they are the same.
- The Answer module's interface is split. Some of its operations take the question being graded, while others take a question id and look the question up in the database themselves. Its tests seed question rows just so that lookup succeeds.
- Which sessions a save reloads is decided by a list built for a different purpose: the running sessions whose frontier the save is checked against. No rule anyone wrote down says that lobby sessions are left out.

## Solution

Every unfinished session on a quiz holds that quiz's current rounds. A save reloads every unfinished session, lobby ones included, so pressing Start quiz plays exactly what the editor shows. The live-edit frontier check still looks only at running sessions, because a lobby session has opened nothing.

All grading reads the session's copy. Submit and hand grading grade against the question as the session holds it, the same question the big screen shows and lock-time grading uses. The Answer module grades stored answers against a question it is given and never looks up a question itself.

Quiz masters see their edits in a lobby session straight away. Teams' answers are graded against the key the room is shown. Running sessions behave exactly as today.

## User Stories

1. As a quiz master, I want a quiz edit saved while a session waits in the lobby to be what that session plays once I press Start quiz, so that I can fix mistakes after opening the lobby.
2. As a quiz master, I want a corrected answer saved while a session is in the lobby to be the answer shown at reveal, so that the room sees the right answer.
3. As a quiz master, I want a question added while a session is in the lobby to be opened in its place when the quiz reaches it, so that late additions aren't lost.
4. As a quiz master, I want a question deleted while a session is in the lobby never to be opened, so that teams can't answer a question that no longer exists.
5. As a quiz master, I want rounds renamed or reordered while a session is in the lobby to show with their new titles and order on the round overview and round intros, so that the big screen matches the editor.
6. As a quiz master, I want a round's break-after or kahoot setting changed while a session is in the lobby to take effect in that session, so that blocks and kahoot rounds behave as I configured them.
7. As a quiz master, I want the big screen and phones in the lobby to receive the saved rounds as soon as the save lands, as a re-import already does, so that every screen shows the current quiz without a press.
8. As a quiz master, I want a save to reach every unfinished session on the quiz, whether in the lobby or running, so that I don't have to think about which sessions have started.
9. As a quiz master, I want a save while sessions are running to be checked against the live-edit frontier exactly as today, so that the opened part of the quiz stays frozen (ADR 0002).
10. As a quiz master, I want a session in the lobby never to cause a save to be refused, as today, so that an unstarted session doesn't block editing.
11. As a quiz master, I want ended sessions left untouched by a save, as today, so that past results keep the quiz as it was played.
12. As a quiz master, I want a re-import into a lobby session to keep updating that session's screens, as today, so that the import flow doesn't change.
13. As a quiz master, I want a team's answer graded at submit against the same key the big screen reveals, so that the auto-grade and the reveal agree.
14. As a quiz master, I want a team's answer graded at submit against the same key lock-time grading and kahoot speed scoring use, so that one question is never graded against two keys.
15. As a quiz master, I want hand grading to follow the same "can this be graded by hand yet" rule as today, so that closest_guess answers still wait for the lock.
16. As a quiz master, I want the verdict for a hand grade (correct, partly correct, incorrect) worked out from the session's question points, as today, so that the verdict matches the points shown.
17. As a quiz master, I want a key fix during a live session to rescore answers exactly as today, so that the accepted key-fix tradeoffs still hold.
18. As a quiz master, I want a key fix to see the grade each answer got at submit as an automatic grade under the old key, so that moderator grades on typed answers survive a key fix as documented.
19. As a quiz master, I want grading to keep working after a backend restart, as today, so that a redeploy during the quiz loses nothing.
20. As a team, I want our answer to a question to be accepted whenever the big screen shows it open, so that we're never refused for a question the session still has.
21. As a team, I want our auto-graded answers marked against the answer the room is later shown, so that our score makes sense at reveal.
22. As a team, I want our answer revisions before the lock to keep their last-write-wins behaviour, as today, so that we can change our minds.
23. As a team, I want a phone that joins a lobby after a quiz edit to see the current quiz's round overview, so that what we read matches the big screen.
24. As a developer, I want one rule for which sessions a save reloads (every unfinished session on the quiz), so that the reload isn't a side effect of the frontier check's session list.
25. As a developer, I want the Answer module to grade against a question it is handed for submit and hand grading, as it already does at the lock, so that it has one way of getting the question.
26. As a developer, I want the Answer module never to read the question table, so that grading can't diverge from the session's copy.
27. As a developer, I want submit to make one database round trip fewer, so that a burst of answers at the end of a question does less work.
28. As a developer, I want the Answer module's tests to pass the question in rather than seed question rows to be looked up, so that their setup is smaller.
29. As a developer, I want a test that saves a quiz while a session is in the lobby, starts it, and checks what it plays and how answers are graded, so that this gap can't come back.

## Implementation Decisions

- **The Live edit module owns the rule "every unfinished session on a quiz holds its current rounds".** Every save reloads every unfinished session on the quiz (lobby and running) inside the same hold, after the rounds are saved. The frontier check, the 409 refusal and the key-fix regrade still use only the running sessions. A lobby session is reloaded with no regrade, because it has no answers.
- **The re-import's "reload this session" option** keeps working for an ended session. For a lobby session the general rule now covers it, so the option must not cause a second reload or a second broadcast. Either narrow the option to "an ended session to reload" or skip a join code that has already been reloaded. Prefer whichever leaves one obvious path.
- **A reloaded lobby session is broadcast to every room**, as a re-import's lobby session is today, so the lobby screens and any phone already joined show the saved rounds.
- **Saves with no running session stay a plain save plus the lobby reloads.** They are still not checked against any frontier.
- **The Answer module's interface narrows to "grade stored answers against this question".**
  - Submit takes the session's question (the same gradable shape lock-time grading takes) instead of a question id to look up.
  - Hand grading resolves the answer's question from the session, not from the answer row's question relation. The answers change module, which already holds the session, finds the question for the answer being graded and passes it in. An answer whose question isn't in the session's quiz is refused, as an unknown answer is today.
  - The Answer module drops its dependency on the question table. Answer rows still reference questions by id, so this is not a schema change.
- **The answers change module is where the session's question is looked up.** For submit, the question is found by the same block-in-play lookup the answering gate already uses, so a submit for a question the session doesn't hold is refused at the gate, as today. For a hand grade, the answer's question id is read first, then the session's question for it.
- **The Answer key is built in one place.** Submit no longer rebuilds an Answer key from a stored row and its payload. The session's question already carries its resolved key from when the session loaded the quiz.
- **No change to the Grading policy**, to what any grading event decides, or to the accepted tradeoffs in CLAUDE.md (key fixes overwrite manual overrides, typed-answer moderator grades survive).
- **Docs.**
  - DOCUMENTATION.md: wherever it describes live edits or what a save does to sessions, say that every unfinished session (lobby included) is reloaded, and that only running sessions are checked against the frontier.
  - GLOSSARY.md: the Live-edit frontier entry speaks only of live sessions, which stays true. Add nothing unless the implementation needs to name the session's copy of the quiz.
  - `/guide`: if it tells the moderator not to edit once a lobby is open, or implies lobby sessions keep the old quiz, update it.

## Testing Decisions

- **A good test here drives the session through the Game module the way the app does.** It saves through the Live edit module, presses Start quiz and Advance, submits and grades through the socket events, then asserts on room views, answer lists and stored grades. It never asserts which repository was or wasn't called.
- **The main seam is the real-store Game module harness.** It carries the reproducer, which is written first and must fail before the fix: create a session, leave it in the lobby, save an edit that corrects an answer, adds a question and deletes one, press Start quiz and advance. Then assert:
  - the opened questions match the saved quiz (the added one appears, the deleted one never opens);
  - the reveal shows the corrected answer;
  - a submit is auto-graded against the corrected answer;
  - the lobby views were re-sent when the save landed.

  Also cover: a save with one lobby and one running session on the quiz checks the frontier against the running one only and reloads both; an ended session is untouched; a re-import into a lobby session still reloads and broadcasts it once. Prior art: the live-edit, live-edit-regrade and quiz-reimported specs in the backend game tests.

- **The Answer module's own specs stay at their seam**, adapted to the narrower interface: submit and hand grade are given the question instead of looking up a seeded question row. The Grading policy's cases (keep, clear, set on submit; can-grade-by-hand refusal; manual verdict) keep their assertions. Prior art: the Answer module's grading, submit-and-list and auto-grading specs, and its test utilities.
- **The existing game-level grading specs must pass unchanged**: submit-answer, answer-recorded-and-graded, grading-gate, kahoot answer speed and last-second answer. They show that running sessions behave exactly as before.

## Out of Scope

- Reloading ended sessions on an editor save. Past sessions keep the quiz as it was played.
- Storing progress by question id, or any change to what a running session's frontier freezes (ADR 0002).
- Grading attribution (who graded what), already listed as an accepted tradeoff.
- The client-side "can grade by hand" copy in the answers panel. That belongs to the Grading policy deciding for the clients (review candidate 4).
- The duplicated question-field mapping between stored rows, previews and the session's copy (review candidate 5).

## Further Notes

- The gap only lasts until the next backend restart, because restoring a session reloads its quiz from the database. That is why it hasn't been seen in testing, and also why it is worth closing: the same session behaves differently depending on whether the backend happened to restart.
- The deleted-question case is the sharpest one. The session opens a question whose row no longer exists, so storing an answer to it fails on the answer's reference to the question. The phone gets an error instead of "answer received". This was found by reading the code and has not been reproduced; the reproducer settles it.
