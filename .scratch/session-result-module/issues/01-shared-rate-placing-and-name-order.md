# 01: One correct-rate rule, one average placing and one tied-name order in shared types

**What to build:** Every place that orders tied team names, and every place that credits answers towards a question's correct rate, follows one rule. Teams tied on the fastest correct answer in the break fun facts, the names in a clean sweep, and the teams tied on the stats page's fastest answer and fastest team all come out in the same order as tied teams on the leaderboard. A question's correct rate is credited the same way in fun facts and on the stats page. The shared code also gains the average placing (unrounded mean, plus the one-decimal display value) that tickets 02 and 03 will use.

This ticket gets the shared rules in place first, so the next tickets can use them as they are.

Parent spec: `.scratch/session-result-module/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Shared types has one question correct-rate rule:
  - an answer's verdict credit: `correct` counts 1, `partial` counts its points' share clamped to 0–1, anything else counts 0;
  - "this question type has a meaningful rate", read from the question type registry (`closest_guess` has none) rather than a hard-coded type check.
- [ ] Fun facts and the stats session detail calc both use that rule. Their two private copies of the credit function are deleted.
- [ ] Shared types has an average placing that returns the unrounded mean of a list of placings (empty for none) and its one-decimal display value. The league table calc and the team history calc both use it, with no change in behaviour.
- [ ] Every tied-name sort in fun facts and the stats session detail uses the ranking rule's name comparison: the fastest correct answer, the clean sweep, the fastest answer and the fastest team. No `localeCompare` remains in that code.
- [ ] Specs cover the credit rule (partial share, clamp, ungraded), the meaningful-rate rule, average placing (empty, unrounded versus displayed), and one tie-order case each for fun facts and the stats fastest answer and fastest team.
- [ ] Typecheck, lint and tests pass.
