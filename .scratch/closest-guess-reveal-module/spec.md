# Spec: One Closest-guess reveal module owns the reveal steps

Status: ready-for-agent

Source: architecture review 2026-10-14, candidate 1 ("Strong", in-process).

## Problem Statement

A closest_guess question is revealed step by step. The big screen starts with the question, then adds the smallest guess, the highest guess, the correct answer and finally the closest team or teams. If nobody guessed, the question and its answer appear together in one step. That rule is written down in three places, each with its own numbering:

- **The step count** lives with the Move plan's reveal stepping: five steps when someone guessed, otherwise one. It decides "is this a closest-guess reveal" from the grading mode (batch-graded), not from the question type registry.
- **The Screen projection** has its own constants for the highest-guess, answer and closest-teams steps, plus a bare "step 1" for the smallest guess. It re-applies the "nobody guessed means one step" rule to trim what the phones are sent.
- **The reveal screen on the frontend** compares the raw step number against the literals 1, 2, 3 and 4, and applies the "nobody guessed" rule a third time. Its comment points at a method that no longer exists.

The Reveal kind is also chosen from the grading mode, even though the glossary says the Screen projection decides it from the question type registry.

This causes a bug teams can see today. During a reveal, a team with auto-advance off can browse back to a closest_guess question that has already been revealed. Its data reaches the phone in full, but the phone draws it at the step of whatever question is on air now, which is usually step 0. The team sees only the prompt: no guesses, no correct answer, no closest teams.

For a developer:

- Adding, removing or reordering a reveal line means changing shared/types, the projection and a React component together, and nothing fails to type-check if they drift apart.
- A future batch-graded question type would silently get the five-step closest-guess reveal, because "batch-graded" is being used to mean "closest guess".
- The step rule can't be tested in one place. Its cases are spread across a backend reveal spec, the players-view redaction spec and the frontend component test.

## Solution

One **Closest-guess reveal** module owns everything about the step-by-step reveal:

- the ordered reveal lines;
- how many steps a question has (including the one-step rule when nobody guessed);
- what is on air at a given step;
- what "fully revealed" means;
- building the summary from a question's answers.

The Move plan asks it how far Advance and Previous can step. The Screen projection asks it for the on-air question as shown at the current step, for the big screen and the phones alike. The reveal screen draws exactly the lines it is sent and never sees a step number. The Reveal kind of a question type becomes a field on the question type registry, so nothing infers it from the grading mode.

Teams and the room see the same reveal as today, step for step. The one difference is the bug fix: a phone that browses back to a closest_guess question that has already been revealed shows it fully revealed.

## User Stories

1. As a quiz master, I want the big screen's closest_guess reveal to start with just the question, so that the room can guess along before any number appears.
2. As a quiz master, I want each Advance during a closest_guess reveal to add the smallest guess, then the highest guess, then the correct answer, then the closest team or teams, exactly as today, so that the reveal builds suspense.
3. As a quiz master, I want every line shown at earlier steps to stay on screen as new ones are added, as today, so that the room sees the whole picture at the end.
4. As a quiz master, I want Previous during a closest_guess reveal to take away the last line added, as today, so that I can step back if I advanced too early.
5. As a quiz master, I want Previous arriving back at a closest_guess question to show it fully revealed, as today, so that stepping back behaves like it does for every other type.
6. As a quiz master, I want a closest_guess question nobody guessed on to show the question and its answer together in one step, as today, so that an empty reveal doesn't drag on.
7. As a quiz master, I want Advance after the last closest_guess step to move on to the next reveal question, as today, so that the reveal flows on without an extra press.
8. As a quiz master, I want answer media to appear on the big screen together with the correct answer, as today, so that the media doesn't give the answer away early.
9. As a quiz master, I want the closest teams to be the teams whose guesses were numerically closest, even if I overrode a grade, as today, so that the screen shows who actually came closest.
10. As a quiz master, I want the big screen to pick up the reveal at the right step after a reconnect or a page reload, so that a dropped connection doesn't skip or spoil anything.
11. As a quiz master, I want a restart during a reveal to resume with correct closest-guess stats, as today, so that a backend redeploy doesn't lose the reveal.
12. As a team, I want the phone's closest_guess reveal to follow the big screen step by step, as today, so that our phone never spoils what the room hasn't seen.
13. As a team, I want the phone to show no correct answer until the big screen reaches its answer step, as today, so that the reveal isn't spoiled.
14. As a team, I want the phone to show the smallest guess, highest guess, correct answer and closest teams at the same steps as the big screen, as today, so that the phone mirrors the room.
15. As a team with auto-advance off, I want to browse back to a closest_guess question that has already been revealed and see its smallest guess, highest guess, correct answer and closest teams, so that I can look back at how we did.
16. As a team with auto-advance off, I want browsing back to an earlier closest_guess question not to change what the on-air question shows when I return to it, so that browsing never spoils or hides anything.
17. As a team, I want "Your answer" and our points shown under a closest_guess reveal, as today, so that we can compare our guess with the result.
18. As a team, I want a phone that reconnects during a closest_guess reveal to show the reveal at the step the big screen is on, as today, so that reconnecting doesn't spoil the answer.
19. As a team, I want a phone that reconnects after the quiz ended to keep the final block's closest_guess questions fully revealed, as today, so that we can still look back at them.
20. As a team, I want closest_guess questions from earlier blocks to show fully revealed when browsing past answers, as today, so that the history still works.
21. As a team, I want every other question type's reveal to stay exactly as it is, so that nothing else changes.
22. As a developer, I want the reveal lines, the step count and what is on air at each step to live in one module, so that changing the reveal is a one-module change.
23. As a developer, I want the "nobody guessed means one step" rule written once, so that the Move plan, the projection and the screens can't disagree about it.
24. As a developer, I want the Screen projection to send each room the on-air closest_guess question already trimmed to its step, so that no screen compares step numbers.
25. As a developer, I want the reveal screen to draw exactly the lines present in the data it's given, so that its test needs no step numbers.
26. As a developer, I want the Reveal kind of a question type to be a field on the question type registry, so that a future batch-graded type doesn't silently get the closest-guess reveal.
27. As a developer, I want a type-check failure if a new question type in the registry doesn't say how it is revealed, so that the decision can't be forgotten.
28. As a developer, I want "fully revealed" to be a named value from the module, so that the reveal walk at `ended` doesn't hard-code the last step.
29. As a developer, I want the closest-guess step behaviour tested through the views each room is sent after real Advance and Previous presses, so that the tests cover what clients actually receive.

## Implementation Decisions

- **The Closest-guess reveal module** is the shared module that already summarises closest_guess answers and steps the reveal, grown into the one owner of the reveal. Its interface:
  - **Summarise** a question's answers into closest-guess stats. This is unchanged: the smallest and highest numeric guesses and the closest guesses by value.
  - **Step count** for a question: more than one only when the question's Reveal kind is `closest_guess` and its stats say someone guessed. The number comes from the ordered reveal lines, not from a literal.
  - **Shown at a step**: given a closest_guess reveal question and a step, return the question as the room sees it at that step. Before the answer step it is `closest_guess_pending` (no answer, no answer media), with only the stats lines reached so far. From the answer step on it is `closest_guess`, with the stats reached so far. When nobody guessed, it is returned whole at every step.
  - **Fully revealed**: a named step (or a "whole" form of shown-at-a-step) used by the ended reveal walk and by Previous arriving backward.
  - The existing stepping used by the Move plan (try to step on Advance or Previous; the initial step on arriving at a reveal) stays in this module and reads the step count above.
- **The reveal lines are one ordered list** inside the module: smallest guess, highest guess, correct answer, closest teams, after the question-only step 0. The step constants and the bare literals in the Screen projection and the frontend go away.
- **The Screen projection trims the on-air closest_guess question for the display room as well as the players room.** It uses the module's "shown at a step" for both. Only the question at the current reveal position is trimmed. Earlier reveal questions are sent whole, as today. The admin view keeps the untrimmed block, because the quiz master sees everything.
- **The display view's reveal questions become the same union the players view uses** (`answer`, `closest_guess`, `closest_guess_pending`), so the big screen can be sent a pending question. The display is a public screen with no secrecy requirement. The point is that the big screen and the phones draw from the same trimmed data.
- **The reveal screen takes no step.** It draws:
  - the prompt always;
  - the smallest guess and the highest guess when present;
  - the correct answer and answer media when the Reveal kind is `closest_guess`;
  - the closest teams when present.

  The big screen and the phone both stop passing the step. This fixes the phone's browse-back bug, because a browsed-to closest_guess question that has already been revealed arrives whole and is drawn whole.

- **The step number stays on the snapshot** where it serves other purposes: the on-air screen key, which re-triggers the screen transition per step, and the admin's presenter preview. No screen draws reveal content from it.
- **The closest-guess stats shape may tighten.** If it helps the screen draw only what is present, "closest teams" can become optional, present only once on air, instead of an empty list before it. Choose whichever keeps the screen free of step logic. The "nobody guessed" flag stays, because the summary and the step count need it.
- **The question type registry gains a Reveal kind field** for each question type: `answer` or `closest_guess`. Only closest_guess says `closest_guess`. It is its own field, never derived from the grading mode, in the same way the kahoot-allowed field is its own field (ADR 0001). Both the step that builds the block's reveal questions and the module's step count read it. The pending kind is not a registry value, because it exists only per step in a view.
- **The grading mode stops deciding anything about the reveal.** The closest-guess reveal no longer uses the batch-graded predicate. Its remaining caller, the answers panel's "graded when the block locks" label, is out of scope here.
- **Docs.**
  - GLOSSARY.md: the Reveal kind entry already says the type registry decides it. Add a **Closest-guess reveal** term for the step-by-step reveal and its lines.
  - DOCUMENTATION.md: update anything that describes the closest_guess reveal steps or the display payload.
  - `/guide`: nothing changes for the moderator.

## Testing Decisions

- **A good test here presses Advance and Previous and reads what each room is sent, or renders a reveal screen from a view.** It never asserts step constants, private helpers or how the trimming is done internally. The same behaviour should survive a reorder of the reveal lines with only the expected sequence changing.
- **The Move plan and the Screen projection are tested through the real-store Game module harness**, as the existing reveal specs are. Prior art: the closest-guess reveal spec, the players-reveal redaction spec, the past-revealed-questions spec and the screen projection spec in the backend game tests. Cover:
  - each step's display and players views for a closest_guess question with guesses: which stats lines are present, and when the answer and answer media appear;
  - one step for a question nobody guessed on, with the answer present at once;
  - Previous stepping back a line, and arriving backward fully revealed;
  - the `ended` walk fully revealed;
  - the admin view untrimmed throughout.
- **The registry's Reveal kind field** is covered by the existing question-kind parity test pattern. Every type declares one, and only closest_guess declares `closest_guess`.
- **The reveal screen's component test** renders `closest_guess_pending` and `closest_guess` views with different stats present and asserts which lines show. It passes no step. Prior art: the closest-guess reveal screen test and the display reveal test.
- **The phone's browse-back regression test** is written first and must fail before the fix. A team with auto-advance off is in the reveal, on air is a later question in the block, and the team browses back to an already-revealed closest_guess question; the test asserts that its guesses, correct answer and closest teams show. Prior art: the phone's break-and-reveal and auto-advance setting tests.

## Out of Scope

- The answers panel's use of the batch-graded predicate for its "graded when the block locks" label. That belongs to the Grading policy deciding for the clients (review candidate 4).
- Batch grading at the lock and the key-fix regrade both use the presence of a cached summary as "already batch-graded". That is grading state, not reveal state, and it stays as it is.
- The showdown reveal. It has its own step-by-step view with a similar shape, but merging it with the closest-guess reveal is not part of this spec.
- Any change to what the reveal looks like or how many steps it has.

## Further Notes

- The browse-back bug comes from the phone passing the session's current reveal step to every closest_guess question it draws, while only the on-air question is trimmed by the server. Taking the step out of the screen removes the whole category of bug rather than patching that one call.
- This builds on the earlier Reveal kind spec (`.scratch/reveal-kind/`), which made reveal views a discriminated union and decided the kind in the projection, still from the grading mode. This spec moves that decision onto the registry.
