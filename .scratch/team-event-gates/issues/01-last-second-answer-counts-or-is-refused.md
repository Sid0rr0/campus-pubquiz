# 01: A last-second answer either counts or is refused

**What to build:** A team that submits in the last second of a block, while the quiz master presses Advance or the locking timer runs out, gets one of two clean outcomes. If the answer is queued first, it's stored and the press sees it: the break's closest_guess batch grades it, and the kahoot speed scoring scores it. If the press is queued first, the answer is refused with "Answers are locked for this question" and nothing is stored. Today the answering check reads the stored session and the answer is stored before the session write. A press can commit into the break in between, so a closest_guess answer can end up stored with no grade and 0 points, and nothing grades it again.

Submit answer checks whether the question is still answerable and whether the socket owns the team's seat, stores the answer, and refreshes the answered teams and grading, all inside one session write, against the session as the previous write left it. The shared answer-refresh step becomes a private helper that builds the change, not a write of its own, so the session write is never entered twice.

This ticket also sets down the rule for later tickets. It goes into `GLOSSARY.md` (**Session write**: an event is checked against the session as the previous write left it, and stores nothing when refused), into `CODING_STANDARDS.md` (a Live session event checks whether it's allowed, does its database writes and changes the session inside its session write), and into `DOCUMENTATION.md`'s note on events applied one at a time.

Parent spec: `.scratch/team-event-gates/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a closest_guess answer on the last question of a block, sent while the Advance into the break is held on its progress save, is refused with "Answers are locked for this question", and the admin answer list for that question doesn't contain it.
- [ ] The same answer, sent first and held on its store while the Advance is pressed, is stored and graded by the break's batch; the admin answer list shows it graded.
- [ ] The same pair of orders with the locking timer's expiry instead of a press.
- [ ] A kahoot answer sent while the lock's press is held is refused; sent first, it's speed-scored like the other answers.
- [ ] An answer store that fails once doesn't hold up the next press.
- [ ] `session-write.spec.ts`, `submit-answer.spec.ts`, `answer-recorded-and-graded.spec.ts` and the closest_guess and kahoot specs pass unchanged.
- [ ] GLOSSARY, CODING_STANDARDS and DOCUMENTATION are updated in the same commit.
