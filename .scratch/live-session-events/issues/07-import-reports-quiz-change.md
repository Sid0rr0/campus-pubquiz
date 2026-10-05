# 07: Import reports a quiz change through quizEdited

**What to build:** When a sheet or CSV import updates the active quiz, it reports the change through the same `quizEdited` entry a live edit uses, with no questions to re-grade. The gateway then delivers the outcome to every room. Today an import reloads the quiz silently, so /display, /play and /control show the old quiz until something else pushes. Once nothing outside the Live session module calls them, `reloadActiveQuiz` and `regradeQuestions` become private. In the same commit, add one line to the import section of `DOCUMENTATION.md`.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** None (can start immediately).

**Status:** done

- [x] Importing into the active quiz in the lobby pushes a fresh view to all three rooms.
- [x] Importing into a quiz that isn't active pushes nothing.
- [x] A live answer-key fix behaves exactly as today: reload, re-grade, answer lists and team syncs.
- [x] `reloadActiveQuiz` and `regradeQuestions` are private.
- [x] `DOCUMENTATION.md` says an import into the active quiz is broadcast.

## Comments

Already implemented before this ticket was picked up, by `fix(backend): re-importing the active quiz rebroadcasts like an editor save` (`fc09bdb`). `ImportService.confirmCsv` calls `notifyQuizEdited(joinCode)` only when the imported quiz is the session's active quiz, and `reloadActiveQuiz` is gone from the public interface (the reload is the private `withReloadedQuiz` step of `quizEdited`; `regradeQuestions` lives on `BlockGradingService`, not the module). `DOCUMENTATION.md` already says the reload and rebroadcast happen through the same path as an editor save. Covered by `quiz-reimported.spec.ts` (gateway broadcast, admin and display rooms) and `import.service.spec.ts` (active vs inactive quiz). No code change; this commit only records the ticket as done.
