# 01: Question outcome module, used by the Session result module

**What to build:** A new pure **Question outcome** module in shared types says how one question went. The Session result module reads it to get each question's counts and correct rate, and the stats page shows the same figures as before.

The module takes:

- the question's type and points;
- that question's answers, each as a verdict (or none while ungraded) and points awarded;
- a team count.

It returns:

- the answered count;
- the correct count;
- the partial count;
- the correct rate: the summed answer credit divided by the team count. It is null when the question type has no correct rate (the registry's `hasCorrectRate`, through `hasMeaningfulCorrectRate`) or when the team count is 0 or less.

See the spec's "The Question outcome module" and "Readers → Session result" sections.

Parent spec: `.scratch/question-outcome-module/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Question outcome module is pure and has no dependency on the session record. It sits beside the shared correct-rate rule, which keeps `answerCredit` and `hasMeaningfulCorrectRate`.
- [ ] It never filters answers by question, team or roster, and never decides which teams count. The caller passes that question's answers and its chosen team count.
- [ ] The Session result module takes each question's answered count, correct count and correct rate from it, with the participant count as the team count. Its own credit sum and meaningful-rate check are deleted, and its output shape is unchanged.
- [ ] A table spec in shared types covers:
  - correct, partial and incorrect counted separately;
  - an ungraded answer counted as answered but neither correct nor partial;
  - a partial answer adding its share of the points, clamped to 0–1;
  - a speed-scaled correct answer adding 1;
  - closest_guess: counts present, rate null;
  - a team count of 0: rate null;
  - no answers: counts 0, rate 0;
  - teams that didn't answer lowering the rate.
- [ ] The existing Session result spec passes unchanged.
- [ ] Docs, in the same change:
  - GLOSSARY.md gains **Question outcome**: how one question went, worked out by one pure module from its answers and a team count chosen by the caller (the live views pass the roster, the stats page passes every team that took part);
  - GLOSSARY.md's **Correct rate** points at it and says "no correct rate" is a registry setting.
- [ ] Typecheck, lint and tests pass.
