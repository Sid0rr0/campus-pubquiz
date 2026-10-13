# 01: A closest_guess question browsed back to on the phone shows fully revealed

**Status:** ready-for-agent

**Blocked by:** None (can start immediately)

**Type:** bug

## What happens

During a block's reveal, a team with auto-advance off can use Prev/Next or the question picker to go back to a question the big screen has already revealed. If that question is a closest_guess question that had guesses, the phone shows only its prompt. The smallest guess, highest guess, correct answer and closest teams are all missing. "Your answer" and the points still show underneath.

**Steps to reproduce**

1. Use a block whose first question is closest_guess (with at least one guess) and whose second is any other type.
2. On a team phone, turn auto-advance off.
3. The quiz master reveals the closest_guess question all the way through, then advances to reveal the second question.
4. On the phone, go back to the closest_guess question.

**Expected:** the phone shows the full closest-guess reveal: smallest guess, highest guess, correct answer (with answer media) and closest teams.

**Actual:** the phone shows only the prompt.

If the question on air is itself a closest_guess question partway through its reveal, the browsed-back question shows only as many lines as the on-air question has reached. For example, at its step 2 the browsed-back question shows the smallest and highest guesses but no answer.

The big screen is not affected, because it only ever draws the question that is on air.

## Why

The server sends the players view every revealed question in the block. Only the on-air one (at `revealIndex`) is trimmed to the current closest-guess step; earlier ones are sent whole. The phone, however, passes the session's single `closestGuessRevealStep` to the closest-guess reveal screen for whichever reveal question the team has selected. That step belongs to the on-air question. When the on-air question isn't closest_guess it is 0, so the screen's own step comparisons hide every line of the browsed-back question.

## What to build

- Write the regression test first, and see it fail. Put it in the phone's reveal tests (prior art: the `/play` break-and-reveal and auto-advance setting tests). It covers both cases above: on air is a non-closest_guess question, and on air is a closest_guess question at an early step. In both, the browsed-back closest_guess question shows all four lines and the answer.
- Fix: the phone applies the closest-guess step only to the reveal question that is on air, which is the one at the view's `revealIndex`. Any other reveal question it shows is drawn fully revealed.
- The on-air question must still follow the big screen step by step. Add a test that, with auto-advance on, the on-air closest_guess question still builds up one line per step.

## Relation to the closest-guess reveal spec

[`closest-guess-reveal-module`](../../closest-guess-reveal-module/spec.md) ticket 03 removes the step from the reveal screen entirely, which removes the cause of this bug. This ticket is the small, immediate fix. Its regression test carries over to ticket 03 and must keep passing there; ticket 03 then deletes the step-picking this ticket adds.

## Acceptance criteria

- [ ] The regression test fails before the fix and passes after
- [ ] A browsed-back closest_guess question shows its smallest guess, highest guess, correct answer and closest teams, whatever the on-air question and step
- [ ] The on-air closest_guess question still steps in time with the big screen
- [ ] `pnpm typecheck` and `pnpm --filter frontend test` pass
