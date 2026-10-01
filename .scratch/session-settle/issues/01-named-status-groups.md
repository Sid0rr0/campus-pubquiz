# 01: Named status groups replace the inline status lists

**What to build:** Each meaningful group of game statuses is defined once in shared types, next to the state machine, as a named read-only set with a matching predicate — answering (question_open, locking, round_intro), question on air (question_open, locking), grading (break_intro, break, break_round_intro), graded (grading plus reveal_intro, reveal, ended), revealing (reveal_intro, reveal), block review (grading plus revealing) and block started (answering plus graded). Every inline status list or comparison chain in the backend, /display, /control and /play reads a group instead. Nothing changes on stage, on the phones or in the socket contract.

Parent spec: `.scratch/session-settle/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The seven groups exist in shared types with predicates, exported for backend and frontend
- [ ] A table test lists every game status and its membership in each group; adding a status fails it until memberships are decided
- [ ] Group membership matches today's lists exactly; where two copies differed, each call site reads the group matching its current behaviour
- [ ] The backend's answering check, grading/graded lists, block-question visibility checks and the timed-phase check read the shared groups; the backend's own grading/graded constants and answering helper are deleted
- [ ] /display's live-question check, /control's answer-status check and /play's break/reveal review check read the shared groups
- [ ] No inline status list for these meanings remains in backend, frontend or shared types
- [ ] Existing gateway harness and frontend tests pass unchanged
