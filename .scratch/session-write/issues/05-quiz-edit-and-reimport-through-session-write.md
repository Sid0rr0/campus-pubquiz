# 05: A quiz edit and a re-import go through the session write

**What to build:** When the quiz master fixes an answer key mid-session, or a quiz is re-imported under a live session, answers and grades that land at the same moment aren't undone, and the ungraded markers stay right. Today the quiz reload reads the session, waits on the database, and stores the old session with the new quiz. The key-fix regrade then runs as its own separate update.

Quiz edited and quiz reloaded become session writes. The steps that are public today and used inside quiz edited (reload the quiz, regrade the corrected questions) are split into steps that take and return a session value without queueing, so a queued write never waits on itself. Only the event methods queue. The re-import path calls the queued quiz-reloaded event. Whether a re-import broadcasts doesn't change. The outcome of a quiz edit (answer lists for re-scored questions, team syncs) is as today.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 02

**Status:** done

- [x] Written first, failing against today's code: an answer graded while a quiz edit waits on its reload keeps its grade, and its question's ungraded marker is right once both finish.
- [x] An answer submitted while a re-import's reload is held is still answered in the admin snapshot afterwards.
- [x] A quiz edit while a press is held finishes after the press, and both changes are in the final snapshot.
- [x] No public event method of the Live session module calls another one from inside a write.
- [x] The quiz-edited, live-edit-regrade, ungraded agreement and import specs pass unchanged.

## Comments

Implemented in the commit titled `feat(backend): quiz edits and re-imports go through the session write` (hash is in git history).

- `quizEdited` is now one session write; the reload and regrade are private steps (`withReloadedQuiz`, `withRegradedQuestions`) that take and return a session value. The public `regradeQuestions` is gone, and `quizEdited` no longer calls `getSnapshot` or `getGameSessionId`.
- The re-import already reached the module through `notifyQuizEdited` → `quizEdited` (no regrade ids), so it gets the queue with no change of its own, and its broadcast behaviour is unchanged.
- The re-import test drives `notifyQuizEdited` directly: imports are only allowed in the lobby or after the quiz has ended, when no question is open to answer, so a real re-import can't overlap an answer. The reload it exercises is the same one.
- Not covered: events not yet on the session write (disconnects, break end time) can still be overwritten by a reload, as they already could be. Ticket 06 moves them.
