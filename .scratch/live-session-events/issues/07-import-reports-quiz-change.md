# 07: Import reports a quiz change through quizEdited

**What to build:** When a sheet or CSV import updates the active quiz, it reports the change through the same `quizEdited` entry a live edit uses, with no questions to re-grade. The gateway then delivers the outcome to every room. Today an import reloads the quiz silently, so /display, /play and /control show the old quiz until something else pushes. Once nothing outside the Live session module calls them, `reloadActiveQuiz` and `regradeQuestions` become private. In the same commit, add one line to the import section of `DOCUMENTATION.md`.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Importing into the active quiz in the lobby pushes a fresh view to all three rooms.
- [ ] Importing into a quiz that isn't active pushes nothing.
- [ ] A live answer-key fix behaves exactly as today: reload, re-grade, answer lists and team syncs.
- [ ] `reloadActiveQuiz` and `regradeQuestions` are private.
- [ ] `DOCUMENTATION.md` says an import into the active quiz is broadcast.
