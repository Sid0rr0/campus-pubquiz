# 01: The Quiz preview checked against a real session

**What to build:** A backend real-store spec checks the Quiz preview's "like the night" order against a real session. It drives the seeded quiz's session with Start quiz, then Advance until the end, reads the display view's screen after each press, and checks that the Quiz preview of the same quiz shows exactly those screen kinds, minus the kinds the preview leaves out. The shared Quiz preview spec stops using its own hand-written press as its oracle.

This ticket locks in today's behaviour before the press moves (tickets 02 and 03). No production code changes.

See the spec's "Testing Decisions" section.

Parent spec: `.scratch/dry-run-press/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] A real-store gateway spec seeds a multi-block quiz with:
  - a plain round;
  - a kahoot round;
  - a round that doesn't break after it;
  - a closest_guess question.

  With no teams joined, it presses Start quiz and then Advance until the quiz ends, collecting the display view's screen kind after each press.

- [ ] It asserts that the Quiz preview of the seeded quiz, in the `night` order, has exactly the live run's screen kinds after leaving out lobby, rules, join overlay, locking, break review, break round title, leaderboard, showdown and ended.
- [ ] It asserts that the live run passed through kinds the preview leaves out.
- [ ] A second case adds a round with no questions and checks the preview against the live run in the same way. The empty round's title card is the one expected difference, shown in front of the next round's (or last).
- [ ] The shared Quiz preview spec's "kind for kind like a real session" case and its hand-written press helper are deleted. Every other case in that spec passes unchanged.
- [ ] Typecheck, lint and tests pass.
