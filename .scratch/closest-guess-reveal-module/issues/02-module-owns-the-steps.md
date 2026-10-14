# 02: The Closest-guess reveal module owns the steps, and both screens are sent the trimmed question

Status: done

Blocked by: 01

Spec: [One Closest-guess reveal module owns the reveal steps](../spec.md)

**What to build:** The Closest-guess reveal module holds the ordered reveal lines and answers three things: how many steps a question has, what is on air at a given step, and what fully revealed means. The Screen projection uses it to send the on-air closest_guess question trimmed to its step to the big screen as well as the phones. The admin view stays untrimmed. Every step looks the same as today on both screens.

- Inside the module, one ordered list: smallest guess, highest guess, correct answer, closest teams, after the question-only step 0. The step count comes from that list, and stays one step when nobody guessed.
- "Shown at a step" moves from the Screen projection into the module:
  - before the answer step: `closest_guess_pending` with the stats lines reached so far, and no answer or answer media;
  - from the answer step on: `closest_guess` with the stats lines reached so far;
  - when nobody guessed: the question whole.
- A named "fully revealed" replaces the projection passing the last step constant to the `ended` walk.
- Delete the projection's step constants and its bare `step >= 1`.
- The display room's view trims its on-air reveal question with the same function. Only the question at the reveal position is trimmed. The display view's reveal-question type widens to the players' union (`answer`, `closest_guess`, `closest_guess_pending`).
- The admin view keeps the untrimmed block reveal questions.
- The big screen keeps working in this ticket. It may still pass the step to the reveal screen until ticket 03, and it draws the same thing, because the data it is sent now matches the step.
- If it helps ticket 03 draw only what's present, make the closest teams optional in the stats, present only once on air, instead of an empty list.
- DOCUMENTATION.md: update the description of what the display room is sent during a closest_guess reveal.

## Acceptance criteria

- [ ] Through the real-store harness, each Advance during a closest_guess reveal (with guesses) gives display and players views with exactly the lines on air, and the answer and answer media only from the answer step
- [ ] A question nobody guessed on reveals in one step, with the answer present at once in both views
- [ ] Previous removes the last line, and arriving backward shows the question fully revealed
- [ ] The `ended` walk is fully revealed; the admin view is untrimmed at every step
- [ ] No step constant or step literal remains in the Screen projection
- [ ] `pnpm typecheck` and `pnpm test` pass
