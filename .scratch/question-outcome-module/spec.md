# Spec: One Question outcome module for how a question went

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 1 ("Strong", in-process).

## Problem Statement

Three places in the app say how a question went, each with its own copy of the rule:

- the break's fun facts (toughest question, room split, nobody got it);
- the reveal's teams-correct count on the big screen ("7 of 12 teams, +2 close");
- the stats page's questions table and highlights, through the Session result module.

Each copy answers the same questions. How many teams answered? How many were correct, how many partly correct? What is the correct rate? Does a correct rate even mean anything for this question type? The copies don't agree on how they answer them.

- **Two tests for "does a correct rate mean anything".** The Session result module asks the question type registry's `hasCorrectRate`, through the shared correct-rate rule. Fun facts (the rate facts and the clean sweep) and the teams-correct count instead test whether the question's reveal kind is `closest_guess`. The two agree today only because closest_guess happens to be the one type that has no correct rate and also reveals step by step. If a type is added, or a type's reveal kind changes, the stats page, the fun facts and the reveal count could disagree about which questions they leave out.
- **Two copies of the credit sum.** Fun facts and the Session result module each sum the answers' credit (correct in full, partial by its share) and divide by a team count, in their own loops. The credit for one answer is already shared, but the sum, the guard against dividing by zero and the "no rate" case are not.
- **A separate read for a figure the session already holds.** The verdict tallies behind the reveal's teams-correct count come from their own database query on every Session write. Fun fact data, read in the same write, already holds the same roster answers with their verdicts. The tallies cost a second query and a second field on the session record. Since they can fail separately, the reveal count and the fun facts can show figures from different moments.

For a developer, the rule "how did this question go" has no single home. A change to it (a new one-winner type, a change to how partial credit counts) has to find all three copies, and only the stats copy reads the registry.

## Solution

A single pure **Question outcome** module in shared types says how one question went. It sits beside the shared correct-rate rule. Given a question's type and points, its answers (each with a verdict and points awarded) and a team count, it returns:

- the answered count;
- the correct count;
- the partial count;
- the correct rate, which is empty when the question type has no correct rate (a closest guess) or the team count is 0.

All three readers ask it:

- **Fun facts** build their outcomes from it, with the live roster count as the team count, as today. Their clean sweep leaves out the questions the registry says have no correct rate.
- **The reveal's teams-correct count** takes its correct and partial counts from it, computed from the session's fun fact data. Whether to show a count at all is decided by the same registry test.
- **The Session result module** takes each question's answered count, correct count and correct rate from it, with the participant count as the team count, as today.

The verdict tallies read, the tally type and the session's tally field are deleted. The session's live results become the leaderboard and fun fact data.

Users should see nothing different. The fun facts, the reveal count and the stats page show the same figures as before, for every question type that exists today.

## User Stories

1. As a quiz master, I want the break's fun facts and the stats page to leave out the same questions from rate-based figures, so that a question called "toughest" during the night can also be the hardest on the stats page afterwards.
2. As a quiz master, I want the reveal's teams-correct count to be hidden for exactly the question types that have no correct rate, so that the big screen never shows "1 of 12 teams" for a question with one winner by design.
3. As a quiz master, I want a closest_guess question still to show no teams-correct count on its reveal, so that its step-by-step reveal of the closest teams is the only result shown.
4. As a quiz master, I want a closest_guess question still left out of the toughest question, room split and nobody-got-it fun facts, so that the facts stay meaningful.
5. As a quiz master, I want a closest_guess question still left out of the clean sweep, so that a team isn't denied a clean sweep because only the closest team gets a closest guess right.
6. As a quiz master, I want the reveal's correct and partial counts to keep counting only roster teams, so that "7 of 12 teams" never counts a team that has left.
7. As a quiz master, I want the reveal's team total to keep counting every roster team, including those that gave no answer, so that the count shows how much of the room got it.
8. As a quiz master, I want the reveal's teams-correct count to update after a hand grade, a lock grade or a key fix, so that a corrected grade shows on the big screen straight away, as today.
9. As a quiz master, I want the reveal's teams-correct count and the fun facts to come from one read of the session's answers, so that they can never show figures from different moments.
10. As a quiz master whose session restarted, I want the reveal's teams-correct count rebuilt from the stored answers, so that a backend restart doesn't blank it, as today.
11. As a quiz master, I want a partial answer to count by its share of the points in both the fun facts and the stats page, so that a match question answered half right counts as half on every screen.
12. As a quiz master, I want a correct answer that speed scoring scaled down to still count as fully correct in every rate, so that a slow but right kahoot answer isn't counted as partly wrong.
13. As a quiz master, I want the stats page's correct rate to keep dividing by every team that took part (teams that left included), so that the stats page describes the whole night, as today.
14. As a quiz master, I want the fun facts' correct rate to keep dividing by the live roster, so that a fact shown during the night describes the teams still playing, as today.
15. As a quiz master, I want a question nobody answered still to produce no fun fact, so that the big screen doesn't call an unanswered question the toughest.
16. As a quiz master running a session with no teams, I want no rate shown anywhere rather than a rate of 0, so that an empty room isn't reported as everyone getting it wrong.
17. As a developer adding a new one-winner question type, I want to set `hasCorrectRate: false` in the question type registry and have the fun facts, the reveal count and the stats page all leave it out, so that I change one entry instead of finding three checks.
18. As a developer changing how a question's reveal works, I want its reveal kind not to decide whether its correct rate counts, so that a reveal change can't silently change the fun facts or the reveal count.
19. As a developer, I want one table test for how a question went, so that changing the credit rule is a change to one fast spec.
20. As a developer, I want one fewer database query on every Session write that touches scores, so that live results cost less to keep fresh.
21. As a developer, I want the session record to stop carrying a field that is a projection of another field, so that the live results read has one less figure to read, log and fall back on.
22. As a developer, I want the Session result module to stop summing credit itself, so that it only adds what is about ended nights (placing, nights won, who took part).
23. As a developer reading the glossary, I want "Question outcome" defined, and "Live results" to name only the figures that exist, so that the terms match the code.

## Implementation Decisions

### The Question outcome module

- It is a new pure, in-process module in shared types, beside the shared correct-rate rule (which keeps `answerCredit` and `hasMeaningfulCorrectRate`). It has no dependency on the session record, so the backend Session result module can call it with plain rows.
- **Interface:** one function. It takes:
  - the question, as its type and points;
  - the question's answers, each as a verdict (or none while ungraded) and points awarded;
  - a team count.

  It returns:
  - the answered count: all given answers, ungraded ones included;
  - the correct count: verdict `correct`;
  - the partial count: verdict `partial`;
  - the correct rate.

- **The correct rate** is the summed `answerCredit` divided by the team count. It is empty (null) when `hasMeaningfulCorrectRate` says the type has none, or when the team count is 0 or less.
- **Caller's job:** the caller passes only that question's answers, and chooses the team count. The module never filters answers by question, by team or by roster, and never decides which teams count.

### Readers

- **Fun facts:**
  - The internal outcomes step builds each revealed question's outcome with the module, using the live roster count (the leaderboard length) as the team count.
  - It keeps its own rules on top:
    - a question nobody answered yields no outcome;
    - a question with no correct rate yields no outcome;
    - "nobody got it" means a correct count of 0;
    - the toughest question and the room split read the rate.
  - The internal revealed-question shape drops its "is closest guess" flag and carries the question type. The clean sweep leaves out questions for which `hasMeaningfulCorrectRate` is false.
  - The fun facts' own credit loop is deleted.
- **Teams correct** (the display view's `teamsCorrect`):
  - It is null outside a reveal, as today.
  - On a question whose type has no meaningful correct rate, it is null, decided by `hasMeaningfulCorrectRate` instead of the reveal kind.
  - Otherwise its correct and partial counts come from the Question outcome of that question's answers in the session's fun fact data, which already holds roster answers only. Its team count stays the leaderboard length.
  - The wire shape `{ correct, partial, teamCount }` is unchanged.
- **Session result:**
  - Each question's answered count, correct count and correct rate come from the Question outcome, with the participant count as the team count.
  - Its own credit sum and its own meaningful-rate check are deleted. Its output shape is unchanged.

### Deletions

- The Standings module's verdict tallies read is deleted, along with:
  - the verdict tally type;
  - the session record's verdict tallies field and its empty default;
  - the live results read's tally entry.
- The live results read now reads two figures: the leaderboard and fun fact data.
- **Failure mode change:** before, a failed tally read kept the old tallies while the fun facts updated. Now a failed fun fact data read keeps both the fun facts and the teams-correct count at their earlier values, which is the same fallback the live results read already applies to any figure.

### Naming

- The fun fact data live result keeps its name, its type and its read. Its doc comment says that the reveal's teams-correct count reads it too. (User decision, 2026-10-21.)

### Docs, in the same change

- **GLOSSARY.md:**
  - Add **Question outcome**: how one question went (answered, correct and partial counts, and its correct rate), worked out by one pure module from its answers and a team count chosen by the caller. The live views pass the roster, the stats page passes every team that took part.
  - Update **Live results** to say "the leaderboard and fun fact data", dropping "verdict tallies".
  - Update **Correct rate** to point at Question outcome and to say that "no correct rate" is a registry setting.
- **DOCUMENTATION.md:**
  - The teams-correct paragraph: the counts come from the session's fun fact data, and "no count" follows the question type's correct-rate setting (today only closest_guess).
  - The live results reads sentence: drop "tallies".
- **docs/architecture.md:** update any live results or Standings read diagram that lists the verdict tallies read.

## Testing Decisions

- **What makes a good test:** it calls a module through its interface with plain inputs and checks only what it returns. No spying on helpers, no asserting which internal function ran.
- **The Question outcome module** gets a table spec in shared types: the one new seam and the main test surface. One case each for:
  - correct, partial and incorrect verdicts counted separately, and an ungraded answer counted as answered but neither correct nor partial;
  - a partial answer adding its share of the points, clamped to 0–1, and a speed-scaled correct answer adding 1;
  - a closest_guess question: counts present, rate null;
  - a team count of 0: rate null;
  - no answers: all counts 0, rate 0 (for a type with a correct rate and a positive team count);
  - teams that didn't answer lowering the rate (the team count, not the answer count, is the denominator).
- **Existing seams stay as regression checks**, updated rather than replaced:
  - **Fun facts spec** (shared types): its closest_guess cases (left out of the rate facts and the clean sweep) and its toughest, room split and nobody-got-it cases must pass unchanged.
  - **Session result spec** (backend, pure): its per-question cases must pass unchanged.
  - **The teams-correct real-store gateway spec** (backend):
    - its cases for correct and partial counted separately, every roster team in the total, no count outside a reveal, no count on a closest_guess reveal, and rebuilt after a restart must pass unchanged;
    - the case that makes only the verdict tally read fail is rewritten: when the fun fact data read fails, the teams-correct count keeps its earlier value while the leaderboard updates.
  - **The live results placement spec**: its tally-read failure case moves to the fun fact data read, and its comment about the tallies coming back now refers to the fun fact data.
  - **The single-room fields spec** and the frontend room view fixture: references to the tally field are removed; `teamsCorrect` itself is unchanged.
- **The Standings service spec** loses any tally-read cases. The fun fact data read's cases (roster-only answers) stay, since that read now also backs the reveal count.
- **Prior art:**
  - the shared correct-rate rule's spec (a small pure table in shared types);
  - the ranking rule tests;
  - the Session result spec;
  - the teams-correct and live results placement specs on the real-store harness.
- **E2E:** run `pnpm e2e` once before the PR. No new journey: the existing journeys already pass through a reveal with a teams-correct count and a break with fun facts.

## Out of Scope

- **The team count each reader uses:**
  - fun facts and teams correct keep the live roster;
  - the Session result module keeps every team that took part.

  The session-result-module spec kept these different on purpose, and this spec doesn't revisit that.

- Renaming the fun fact data live result or its type (user decision).
- Any change to which questions fun facts draw from (past blocks only), how they are picked or worded, or when they show.
- The stats page's highlights and round rates. They already read the Session result module's correct rate, and they keep doing so.
- The closest-guess reveal's own use of the reveal kind to decide that a question reveals step by step. That is about how a question is revealed, not whether its correct rate means anything.
- Folding the leaderboard read and the fun fact data read into one query.

## Further Notes

- Confirmed with the user on 2026-10-21:
  - one new seam (the Question outcome function, table-tested), with the existing fun facts, Session result and teams-correct specs kept as regression checks;
  - the fun fact data live result keeps its name.
- This is a behaviour-preserving refactor for every question type that exists today. Any visible change after it ships is a bug.
- The roster-only filter that both the old tally read and the fun fact data read apply in SQL is what keeps the reveal count's figures unchanged. The fun fact data read must keep that filter.
