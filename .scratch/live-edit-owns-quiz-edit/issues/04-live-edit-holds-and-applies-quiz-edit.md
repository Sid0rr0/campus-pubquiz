# 04: The Live edit module holds the quiz's sessions and applies the quiz edit itself

**What to build:** Saving a quiz from the editor, or re-importing it, while sessions play it behaves exactly as today. The same edits are accepted, the same ones are refused with a 409, key fixes re-score as before, and the room sees the same pushes in the same order. The difference is that the Live edit module now does the whole save itself, with no hop through the game state class.

- **Live sessions.** The Live edit module reads the sessions on the quiz that aren't in the lobby and haven't ended from the Session write module's list. This is used both for "does this quiz have a live session" and inside the save.
- **The hold.** It holds every session on the quiz that hasn't ended, lobby sessions included, through the Session write module's hold. Inside the hold it reads the live sessions, merges their frontiers using the shared function from ticket 01, checks the save, and persists it.
- **The quiz-edit change.** The Live edit module builds it. It reloads the session's rounds and keeps its session, join code and progress. When there are questions to re-grade, it re-grades them through block grading's key-fix re-grade. It returns:
  - a plain broadcast when nothing was re-graded,
  - otherwise a broadcast that also names the re-scored questions for the admin answer list and carries a sync for each connected team with an answer to one of them.

  Each held live session gets the change through the held writer.
- **A re-import's session that isn't live.** After the hold is released, if that session is still on the quiz (read through the Session write module), the same change goes through an ordinary session write.
- **Delivery is unchanged.** Outcomes are collected during the hold and delivered through the gateway after it is released. On a failed save, the deliveries collected so far are tried with errors logged and swallowed, and the save's own error is rethrown.

The Live edit module's dependencies become:

- the quiz service,
- the gateway,
- the Session write module,
- the seed service,
- block grading.

It no longer depends on the game state class. The game state class loses:

- quiz edited,
- the quiz-edit step and the reload helper,
- applying a quiz edit to a held session,
- holding a quiz's sessions,
- listing live sessions,
- the HeldQuizSessions type.

It keeps "which quiz is this session on" for the quiz controller.

Parent spec: `.scratch/live-edit-owns-quiz-edit/spec.md`

**Blocked by:** 01, 02, 03

**Status:** done

- [x] The Live edit module doesn't import the game state class. The game state class has none of the members listed above, and the HeldQuizSessions type is gone.
- [x] The Live edit module's interface (whether a quiz has a live session, the quiz's merged frontier, and save with its options) is unchanged. The quiz controller and the import module need no edits.
- [x] Refusals (409 with its issues, 422, 404), re-grade results, admin answer lists, team syncs and delivery order are unchanged.
- [x] The real-store harness builds the Live edit module with its new dependencies. No spec assertion changes.
- [x] Every existing spec passes without assertion edits, in particular:
  - live-edit, live-structural-edit, live-edit-regrade, quiz-edited, quiz-reimported, opened-questions,
  - the real-store failing-delivery spec from ticket 02,
  - the session-write spec's quiz-edit and re-import cases,
  - the quiz controller and import specs.
- [x] If `docs/architecture.md` shows the live-edit save flow, it shows the Live edit module holding the sessions and applying the quiz-edit change through the Session write module.
- [x] `pnpm test`, `pnpm typecheck` and `pnpm lint` pass.
