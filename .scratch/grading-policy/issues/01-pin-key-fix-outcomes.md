# 01: Pin the key-fix outcomes the refactor must keep

**What to build:** Two tests that pin what a live answer-key fix sends today in the cases ticket 03 is most likely to break. Both are driven through the real-store gateway harness and pass against today's code. Only tests change.

- **A team that answered has disconnected.** The quiz master corrects a shown question's key. The teams still connected get their rescored answers synced, the disconnected team gets nothing, and the leaderboard includes its rescored points. This pins the split between "teams with an answer to a rescored question" (block grading) and "connected teams to sync" (Live session module).
- **One save corrects two questions.** A single edit corrects an auto-graded question and a typed question (free_text, audio or YouTube) in the same block. Both admin answer lists are refreshed, each answering team is synced once with both answers, and the admin view's ungraded set reflects the typed question's new state. This pins the merge across several rescored questions that moves into the block grading module.

Parent spec: `.scratch/grading-policy/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] The disconnected-team test asserts: no team sync is sent to the disconnected team, the connected teams each get one with their rescored points, and the leaderboard shows every team's rescored total.
- [ ] The two-question test asserts: an admin answer list for each corrected question, exactly one team sync per answering team, and an ungraded set that matches a fresh read of the database.
- [ ] Both tests go in whichever of the quiz edited and live edit regrade specs already sets up the matching quiz, and reuse their helpers.
- [ ] Both pass against today's code, without any production change.
