# 02: Answers recorded and graded go through the session write

**What to build:** When teams submit answers and the quiz master grades them at a busy moment, the leaderboard, `/control`'s answered markers and its ungraded markers all end up right. Today answer recorded and answer graded each fetch the answer list and a grading refresh (ungraded set plus standings) and then apply them. An older fetch can land after a newer one.

Answer recorded and answer graded become session writes. Inside the write they still read the question's answered teams and run the grading refresh for that question, and the standings come from the session write's last step. The admin answer list for the question is still part of the outcome. Delivery is unchanged.

Parent spec: `.scratch/session-write/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Written first, failing against today's code: two grades in quick succession, with the first grade's standings read held. The final leaderboard reflects both grades.
- [x] Two answers from different teams to the same question, with the first held: the final admin snapshot shows both teams as answered for that question.
- [x] Grading the last waiting answer in the break clears that question's ungraded marker, even when another grade overlaps it.
- [x] The answer-recorded-and-graded, grading, submit-answer and ungraded agreement specs pass unchanged.

## Comments

Implemented in the commit `feat(backend): answers recorded and graded go through the session write` (see git history for the hash). `refreshAfterAnswerChange` now runs inside `writeSession`; it applies its result onto the live session after its reads so disconnects and other not-yet-migrated events landing meanwhile aren't put back (tickets 03/04/06 close that fully).
