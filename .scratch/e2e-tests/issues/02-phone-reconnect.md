# 02: A reloaded phone gets its team back

**What to build:** A journey where a phone is reloaded mid-block and comes back to the same team, its answers and the current question, without typing anything.

1. Two teams join, and the quiz master opens the block's first questions.
2. Team A answers a question.
3. Team A's phone reloads its page; the context and its `localStorage` stay the same.
4. The phone shows Team A, the current question and Team A's answer to the earlier question. `/control` shows Team A as connected again.
5. Team A changes its answer after the reload, and the change sticks through locking and grading.

A second case: the phone goes offline (`context.setOffline(true)`) for a few seconds while the quiz master advances, then comes back and shows the question the game has moved on to.

Parent spec: `.scratch/e2e-tests/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The reload case passes.
- [ ] The offline-then-online case passes.
- [ ] Both pass `--repeat-each=5`.
