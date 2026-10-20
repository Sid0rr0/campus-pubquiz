# 01: "Your answer" on the phone reveal is coloured by its Verdict

**What to build:** When a team's phone shows a revealed question in the block browser, "Your answer" is coloured by the team's Verdict for that question, not by whether it earned full points:

- green for `correct`;
- the partial colour for `partial`;
- magenta for `incorrect` or no answer.

A team that answered a kahoot question correctly but not first, so speed scoring scaled its points down, now sees green, matching the verdict card it just saw. The "n / max points" line is unchanged.

Parent spec: `.scratch/display-screen-content/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] The block browser's reveal colours "Your answer" from the team's own answer grades, which `/play` already holds and the verdict card already reads, using the verdict card's colour for each Verdict.
- [x] Nothing in the block browser decides correctness by comparing points with the question's points.
- [x] Frontend specs:
  - a speed-scaled correct kahoot answer is green;
  - a partial answer is shown as partial;
  - an incorrect answer and no answer are magenta;
  - an ungraded answer is shown as today.
- [x] DOCUMENTATION.md's phone reveal paragraph says "Your answer" is coloured by its Verdict.
- [x] Typecheck, lint and tests pass. If an E2E journey checks the reveal colour, it follows the new rule.
