# 01: Every quiz save reloads the sessions waiting in the lobby

Status: done

Spec: [Every session holds the current quiz, and grading reads only that copy](../spec.md)

**What to build:** A quiz save reloads every unfinished session on the quiz, lobby sessions included, and broadcasts each one. So a session started after an edit plays the edited quiz. Only running sessions are checked against the live-edit frontier and regraded, as today.

- Write the reproducer first, and see it fail. Using the real-store Game module harness, create a session and leave it in the lobby. Save an edit through the Live edit module that:
  - corrects one question's answer;
  - adds a question;
  - deletes a question;
  - renames a round.

  Press Start quiz and advance through the edited round. Assert:
  - the round overview and round intro show the new title;
  - the added question opens in its place;
  - the deleted question never opens;
  - a submit to the corrected question is auto-graded against the new answer, and the reveal shows it.

- Inside the save's hold, after the rounds are saved, reload every unfinished session on the quiz:
  - running sessions as today, through the quiz-edit change with their regrades;
  - lobby sessions through the same change with no regrades.
- A save with no running session is still not checked against a frontier, but it now reloads the lobby sessions.
- A lobby session's reload is broadcast to every room, like a re-import's lobby session today.
- The re-import's reload option must not reload or broadcast a lobby session twice. Narrow it to the ended-session case, or skip a join code already reloaded. Keep one obvious path.
- Ended sessions are not reloaded by an editor save.
- DOCUMENTATION.md: describe what a save does to lobby sessions versus running ones.
- `/guide`: check whether it says anything about editing while a lobby is open, and correct it if so.

## Acceptance criteria

- [ ] The reproducer fails before the change and passes after
- [ ] With one lobby and one running session on the quiz, a save is checked against the running session's frontier only, and both sessions are reloaded
- [ ] A session in the lobby never causes a save to be refused
- [ ] An ended session is untouched by an editor save
- [ ] A re-import into a lobby session reloads and broadcasts it exactly once
- [ ] The live-edit, live-edit-regrade, live-edit-delivery-failure and quiz-reimported specs pass
- [ ] `pnpm typecheck` and `pnpm test` pass
