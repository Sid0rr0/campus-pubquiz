# 02: Answers carry a grading state to /control

**What to build:** Every answer in the admin answer list, whether it arrives in the `ANSWERS_UPDATED` payload or the REST answer list, says whether the quiz master can grade it now: `graded`, `ungraded` or `awaiting_batch`. The Grading policy works it out from the same rule that refuses a hand grade. The `/control` answers panel renders the state it is sent and never asks about the question type's grading mode. Quiz masters see exactly what they see today: "Graded when the block locks" for a closest_guess answer before its batch has run, grade controls for everything else, and the same sort order.

Parent spec: `.scratch/grading-state/spec.md`

**Blocked by:** None (can start immediately). Touches the same policy module as ticket 01, so run them in order to avoid a rebase.

**Status:** done

- [ ] The Grading policy exposes one function from a question and a stored answer to a grading state, driven by a table keyed by grading mode so a new mode fails typecheck until it answers. An answer with a grade is `graded`; without one it is `ungraded` or `awaiting_batch` according to the hand-grade rule.
- [ ] The answer service maps stored answers to admin answer views in one place that asks the policy; every path returning an admin answer list (question list, key-fix regrade, lock batch, hand-grade refresh) goes through it, without adding a query per answer.
- [ ] The shared admin answer view and the socket event schema carry the grading state; the team's own answer view is unchanged.
- [ ] The answers panel switches exhaustively on the state, drops its `isBatchGradedType` import, and keeps its sort order and formatting.
- [ ] Backend real-store specs assert the state on the answer list a room is sent: closest_guess is `awaiting_batch` after submit and before the lock and `graded` once the batch ran; never `ungraded`, including after a restart that cleared the in-memory summaries; auto-graded is `graded` on submit; a missed free_text/audio/YouTube answer is `ungraded` then `graded` after hand grading; a key fix that clears an automatic grade returns it to `ungraded`; the REST list and `ANSWERS_UPDATED` agree.
- [ ] Panel Vitest fixtures assert `awaiting_batch` shows "Graded when the block locks" with no grade controls, `ungraded` and `graded` show controls (selected grade marked for `graded`), a closest_guess question with `graded` answers shows controls, and sort order is unchanged.
- [ ] The Grading policy spec covers the state table for every grading mode, including batch before and after its batch.
- [ ] GLOSSARY.md defines grading state and updates the Grading policy entry; DOCUMENTATION.md and the CODING_STANDARDS.md grading line are updated. `/guide` is unchanged.
- [ ] Build on the uncommitted answers panel edits in the working tree rather than discarding them.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend and frontend tests pass.
