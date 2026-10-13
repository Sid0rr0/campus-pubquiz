# 02: A question's correct rate credits each answer by its verdict

Status: ready-for-agent

Spec: [Stats take totals from the Standings module and credit answers by verdict](../spec.md)

**What to build:** On the session detail stats page, a question's correct rate credits each answer by its verdict:

- `correct` counts in full;
- `partial` counts as its points' share of the question's points, between 0 and 1;
- `incorrect` or ungraded counts nothing.

The rate is the summed credit divided by the participant count. The check on whether the question's answer kind is `match` goes away. Hand-graded partial marks now count, `match` partial credit stays as it is, and a correct speed-scaled kahoot answer counts in full.

- Write the cases first in the pure session-detail calculation spec, and see the new ones fail:
  - a free_text question with partial hand-graded marks rates at the summed shares (fails today: rated 0);
  - a kahoot question where every team answered correctly but with speed-scaled points rates 1 (fails today for `match`);
  - a `match` question with partial pairs rates as today;
  - ungraded answers count 0;
  - the hardest question highlight prefers a question with no credit over one with partial credit.
- Replace the answer-kind branch in the question row's correct rate with the verdict-based credit. The question's correct count (fully correct answers) is unchanged, and so are the all-correct and none-correct highlights.
- Round correct rates, points percentages, the difficulty label and standings are untouched.
- DOCUMENTATION.md: if it describes the stats page's correct rate, update it to the verdict-based credit.

## Acceptance criteria

- [ ] The new calculation cases fail before the change and pass after
- [ ] The question correct rate no longer reads the answer kind
- [ ] Correct counts, round rows, difficulty and standings in the existing calculation spec are unchanged
- [ ] `pnpm typecheck` and `pnpm test` pass
