# Spec: Let the reveal view say what kind of reveal it is

Status: done

Source: architecture review 2026-10-13, candidate 07 ("Speculative", in-process).

## Problem Statement

The server already knows exactly how each question will be revealed. It builds the reveal questions for the block, attaches closest-guess stats only to closest_guess questions, and, for the players view, removes the answer from a closest_guess question whose answer step isn't on air yet. It also decides which types carry a margin when it projects a question view. But none of that decision reaches the screens as a value. Each screen has to work it out again from the question type:

- **The big screen's reveal** checks "is this type batch-graded, and does it have closest-guess stats?" to choose between the closest-guess reveal sequence and the ordinary question-with-answer reveal.
- **The phone's reveal** repeats the same check. It then also asks `'answer' in revealQuestion` and `'answerMediaUrl' in revealQuestion`, because the players view may send a pending closest-guess question that has no answer yet. The TypeScript type is a union with no discriminant, so the screen has to test whether a field exists.
- **Margin text** is shown only for a Number question. The big screen's question body, its reveal body and the phone's question prompt each ask the registry whether the type has a margin. Number and closest_guess share the `number` answer kind, so the answer-kind table can't tell them apart.

For a developer, this means:

- The reveal rules live in two places. The projection decides what to send, and each screen re-derives what was sent. A new reveal shape (another batch-graded type, or a step-by-step reveal for another type) has to be added to the projection and to every screen that re-checks the type, and nothing makes a forgotten screen fail to compile.
- The screens import grading predicates (`isBatchGradedType`, `hasMarginType`) only to draw a screen. A change to how a type is graded can silently change what a screen draws.
- The phone's "does this field exist" checks are the only thing standing between a pending closest-guess reveal and showing an empty answer. If someone renames a field, the type checker won't catch it.

Quiz masters and teams don't see any problem today. This is about keeping the reveal correct as question types are added.

## Solution

Every reveal question the server sends carries a **reveal kind**: a discriminant that says how the question is revealed. Each screen switches on it:

- **answer**: the ordinary reveal. The question with its correct answer, laid out by its answer kind. Every type except closest_guess.
- **closest_guess**: the step-by-step closest-guess reveal, with the correct answer and the closest-guess stats.
- **closest_guess_pending**: only in the players view, for the closest_guess question the big screen is revealing before its answer step is on air. It has the stats shown so far and no answer.

The Screen projection is the only place that decides the reveal kind, reading the question type registry once. The screens stop importing grading predicates to draw a reveal. The phone's union narrows on the reveal kind, not on whether a field exists, so a screen that ignores a kind fails to compile.

The margin follows the same rule: **a question view carries a margin if and only if its type has one**, with the default margin filled in by the projection. A screen shows margin text when the view has a margin and never asks the registry.

Quiz masters, teams and the big screen see no difference. Every reveal step, answer, stat and margin text appears exactly as it does today.

## User Stories

1. As a team, I want the phone's reveal of a closest_guess question to build up step by step in time with the big screen, exactly as today, so that we don't see the answer before the room does.
2. As a team, I want the phone to show no correct answer for a closest_guess question until the big screen reaches its answer step, as today, so that the reveal isn't spoiled.
3. As a team, I want the phone to show the lowest guess, highest guess, correct answer and closest teams at the same steps as the big screen, as today, so that the phone mirrors the room.
4. As a team, I want a closest_guess question that nobody guessed on to show the question and its answer together in one step on the phone, as today, so that an empty reveal doesn't drag on.
5. As a team, I want every other question type to show our answer, the correct answer and our points on the phone at reveal, as today, so that we know how we did.
6. As a team, I want the phone to show "Your answer" and our points under a closest_guess reveal, as today, so that we can compare our guess with the result.
7. As a team, I want the phone to show a Number question's accepted range while the question is open, as today, so that we know how precise our answer must be.
8. As a team, I want the phone not to show margin text for a closest_guess question, as today, so that we aren't told there's a margin when the closest team wins.
9. As a team, I want a Number question with no margin set to show the default margin text, as today, so that the hint matches how we're graded.
10. As a team, I want a phone that reconnects during a reveal to pick up the reveal at the step the big screen is on, as today, so that a dropped connection doesn't spoil or skip anything.
11. As a team, I want a phone that reconnects after the quiz has ended to keep the final block's revealed answers, as today, so that we can still look back at them.
12. As a team, I want to browse back to questions already revealed in earlier blocks and see their answers, as today, so that the history still works.
13. As a quiz master, I want the big screen's closest_guess reveal to step through lowest guess, highest guess, correct answer and closest teams, exactly as today, so that the reveal still builds suspense.
14. As a quiz master, I want the big screen's reveal of every other type to show the question with its correct answer and answer media, as today, so that the ordinary reveal is unchanged.
15. As a quiz master, I want the big screen to show a Number question's accepted range while the question is open and with the answer at reveal, as today, so that the room sees how precisely it was graded.
16. As a quiz master, I want the big screen to show a closest_guess answer without a range, as today, so that the room isn't shown a range that doesn't apply.
17. As a quiz master, I want media autoplay and fullscreen to keep working on the reveal screen, as today, so that answer media still plays as configured.
18. As a quiz master, I want a live answer-key fix to a revealed question to show the corrected answer on the big screen and phones, as today, so that a corrected key is visible immediately.
19. As a developer, I want each reveal question to say how it is revealed, so that a screen draws it without re-deriving the decision from the question type.
20. As a developer, I want the reveal kind decided in exactly one place, the Screen projection, so that the projection and the screens can't disagree.
21. As a developer, I want the reveal kinds to be a discriminated union, so that a screen that doesn't handle a kind fails to type-check.
22. As a developer, I want a pending closest-guess reveal to be its own kind with no answer field, so that the phone never needs to check whether a field exists.
23. As a developer, I want the /display and /play screens to stop importing `isBatchGradedType` and `hasMarginType`, so that a grading change can't silently change what a screen draws.
24. As a developer, I want the margin on a question view to mean "this type has a margin", with the default filled in, so that a screen shows margin text from the view alone.
25. As a developer adding a new batch-graded question type, I want to add its reveal kind in the projection and have the compiler point me at every screen that must handle it, so that no screen is forgotten.
26. As a developer adding a new question type that reveals like the others, I want it to get the answer reveal kind automatically from the registry, so that it needs no screen changes.
27. As a developer, I want the closest-guess stats to exist only on closest_guess kinds, so that no other reveal question carries an always-empty field.
28. As a developer, I want the players-view redaction (removing the answer before the answer step) to produce the pending kind directly, so that redaction and the reveal kind are one decision.
29. As a developer, I want the reveal kind tested through the existing projection specs, so that the test checks what each room is actually sent.
30. As a developer, I want the reveal screens tested against view fixtures of each reveal kind, so that each kind's rendering is checked without a running backend.
31. As a developer, I want the glossary to define the reveal kind, so that the term means the same thing in code, specs and conversation.

## Implementation Decisions

- **New domain term: reveal kind.** A property of a reveal question view that says how the screens reveal it: `answer`, `closest_guess` or `closest_guess_pending`. It is not a question type and not an answer kind. Several types share `answer`. Add it to the glossary.
- **The reveal question views become a discriminated union on the reveal kind.**
  - The `answer` kind is the block question view plus the correct answer and optional answer media. It has no closest-guess stats.
  - The `closest_guess` kind adds the closest-guess stats to that. When nobody guessed, the stats say there were no submissions, as today.
  - The `closest_guess_pending` kind is the block question view plus the closest-guess stats shown so far. It has no correct answer and no answer media. It replaces today's pending closest-guess reveal view, which had no discriminant.
  - The block reveal question view (what /display and the admin views receive) is the union of `answer` and `closest_guess`. The players view's reveal questions are the union of all three kinds.
- **The seeded question isn't a reveal view.** The seeded game's questions keep their stored shape, with no reveal kind and no closest-guess stats. The reveal kind and the stats are added only when the block's questions are dressed as reveal views. Today the seeded question type carries an optional closest-guess field that only the dressing step fills. That field moves to the `closest_guess` kind.
- **The dressing step decides the reveal kind once.** The step that builds the block's and past blocks' reveal question views from the seeded game asks the question type registry (today, whether the grading mode is batch). It sets `closest_guess` with the cached stats (or the "no submissions" stats) for batch-graded types, and `answer` for all others. Nothing else maps a type to a reveal kind.
- **The players-view redaction produces the pending kind.** When the on-air closest_guess question is trimmed before its answer step, the result is the `closest_guess_pending` kind. At or after the answer step, it stays `closest_guess` with its stats trimmed to the current step. A question nobody guessed on is sent whole as `closest_guess`, as today. The final block's reveal walk at `ended` keeps its questions whole, as today.
- **The big screen switches on the reveal kind.** The reveal screen draws the closest-guess reveal sequence for `closest_guess` and the ordinary question display for `answer`. The block reveal view never carries the pending kind, so /display doesn't handle it.
- **The phone switches on the reveal kind.** The phone's question browser draws the closest-guess reveal sequence for both closest-guess kinds. It passes the correct answer and answer media only for `closest_guess`, and the ordinary question display for `answer`. The "Your answer" line and the points line stay as they are for every kind.
- **A question view carries a margin if and only if its type has one.** The projection that strips the answer from a question includes the margin for every type the registry marks as having one, filling in the default margin when none was stored. It leaves the margin out for every other type, as today. The margin's meaning on the view becomes "this type is graded within this margin", not "Number only, undefined means default".
- **Screens show margin text from the view.** The big screen's question body for the `number` answer kind, its reveal body for that kind, and the phone's open-question prompt show margin text when the view has a margin. They no longer ask the registry. The reveal body formats the answer with its range when a margin is present, and shows the plain answer otherwise (closest_guess).
- **Screens may still read the question type for formatting.** Formatting an answer value by answer kind, and the answer-kind body tables, stay keyed by type or answer kind. Only the "which reveal" and "has a margin" checks move into the view.
- **No wire protocol version change.** The views are shared types used by both apps, which deploy together, so there is no compatibility shim. The socket event schemas that describe the views are updated with them.
- **The reveal step count stays server-side.** How many reveal steps a question has, and the on-air screen key, still come from the registry in shared code. They are projection logic, not screen logic, and aren't affected.

## Testing Decisions

- **A good test checks what an audience is sent and what a screen shows, not how the view was built.** Assert the reveal kind and fields on the payload a room receives, and the text and elements a screen renders for a given view. Don't assert which helper chose the kind, and don't spy on the dressing or redaction steps.
- **Seam 1: the Screen projection, through the existing backend real-store specs.** These already drive a session to a reveal and inspect each room's payload. Extend them to assert:
  - every non-closest_guess reveal question carries the `answer` kind with its answer, and no closest-guess stats
  - a closest_guess reveal question carries the `closest_guess` kind in the display and admin views at every step
  - the players view carries `closest_guess_pending` with no answer and no answer media before the answer step, and `closest_guess` with trimmed stats from the answer step on
  - a closest_guess question nobody guessed on is sent as `closest_guess` at step 0
  - past blocks' revealed questions and the `ended` reveal walk carry the right kinds
  - a Number question view always carries a margin (the default when none was stored), and closest_guess and every other type never do
  Prior art: the closest-guess reveal spec, the players reveal redaction spec, the reveal paging spec and the session snapshot leak spec.
- **Seam 2: the /display and /play reveal screens, rendered from view fixtures in the existing Vitest suites.** Fixtures are built per reveal kind. Assert:
  - /display draws the closest-guess sequence for `closest_guess` and the question with its answer for `answer`
  - /play draws the closest-guess sequence with no correct answer for `closest_guess_pending`, and with the answer for `closest_guess`
  - margin text appears exactly when the fixture view has a margin, on the big screen's question and reveal and on the phone's open prompt
  Prior art: the display reveal tests, the play break-and-reveal tests and the closest-guess reveal screen component test.
- **No new seam.** The reveal kind is not unit-tested as a separate pure function. The projection specs already pin it at the boundary that matters.
- **Type-level coverage.** An exhaustive switch on the reveal kind in each screen makes a missing kind a typecheck failure. The pre-commit hook and CI already run typecheck.

## Out of Scope

- **The control panel's grading checks.** The answers panel's batch-graded check is about grading, not reveal, and belongs to the Grading policy work (candidate 01, the grading-mode-policy spec).
- **Backend registry checks.** The live-edit guard's margin check, the answer service and Block grading read the registry on the server, which is where registry reads belong. The answer key value (candidate 02) is a separate effort.
- **Changing what any screen shows.** No new reveal steps, layout changes or copy changes.
- **The showdown reveal.** It is not a question reveal and already has its own view and step counter.
- **The quiz editor.** It works on stored questions, not reveal views.
- **A lint rule banning the grading predicates in screens.** Possible later, but the exhaustive switch and the removed imports are enough for three call sites.

## Further Notes

- The review rated this "Speculative": it removes three screen-side type checks and some field-existence checks. It earns its keep the next time a question type gets its own reveal shape, because the compiler then lists every screen to update.
- The reveal kind doesn't depend on candidates 01, 02, 04 or 05. The margin part does depend on candidate 02 (the `answer-key` spec): that spec makes the Answer key the only place that fills in a default margin, so the projection takes the margin from the Answer key's grading settings instead of applying the default itself. The margin text and Number reveal are also touched by answer-key ticket 03, so whichever lands second rebases.
- ADR 0003 (Number is its own question type) is respected: the margin stays a property of the Number type in the registry, and this spec only changes how the view tells the screens about it.
- Docs to update in the same change: the glossary (reveal kind) and DOCUMENTATION.md, wherever it describes the reveal views or the players-view redaction. /guide doesn't change, because nothing the moderator sees changes.
