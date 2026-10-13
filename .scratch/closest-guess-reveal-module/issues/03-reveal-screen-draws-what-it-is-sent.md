# 03: The reveal screen draws what it is sent, and the phone's browse-back shows the full reveal

Status: ready-for-agent

Blocked by: 02

Spec: [One Closest-guess reveal module owns the reveal steps](../spec.md)

**What to build:** The closest-guess reveal screen takes no step. It always draws the prompt. It draws the smallest guess, highest guess and closest teams when they are present, and the correct answer and answer media when the Reveal kind is `closest_guess`. The big screen and the phone stop passing the step. This fixes the bug where a phone with auto-advance off browses back to a closest_guess question that has already been revealed and sees only the prompt.

- Write the regression test first, and see it fail. On `/play`, a team has auto-advance off. The block is in reveal, a later question is on air, and the team browses back to an already-revealed closest_guess question that had guesses. The test asserts that its smallest guess, highest guess, correct answer and closest teams show. If [`phone-browse-back-closest-guess`](../../phone-browse-back-closest-guess/issues/01-browsed-back-closest-guess-shows-fully-revealed.md) is already done, that test exists: keep it passing, and delete the phone's "step only for the on-air question" logic that the bug ticket added.
- Remove the step prop from the reveal screen and from both places that render it: the big screen's reveal and the phone's reveal body. Remove the step from the phone question browser's props if nothing else there needs it.
- The screen has no step comparisons and doesn't check whether anyone guessed in order to decide whether to show the answer. The Reveal kind and the fields present say it all.
- Fix the stale comment that points at a method that no longer exists.
- The step stays on the snapshot for the on-air screen key and the presenter preview. Don't remove it from the wire.
- GLOSSARY.md: add **Closest-guess reveal**: the step-by-step reveal of a closest_guess question (question; then smallest guess, highest guess, correct answer, closest teams, one more line per Advance; one step when nobody guessed), owned by one module and sent to each screen already trimmed to the step on air.

## Acceptance criteria

- [ ] The browse-back regression test fails before the change and passes after
- [ ] The reveal screen's component test renders pending and full views with different stats present and passes no step
- [ ] The display reveal test and the phone break-and-reveal tests pass, with the same lines at each step as before
- [ ] No closest-guess step number is read by any frontend drawing code
- [ ] GLOSSARY.md has the Closest-guess reveal term
- [ ] `pnpm typecheck` and `pnpm test` pass
