# Spec: The Grading policy decides whether an answer can be graded now, for the clients too

Status: done

Blocked by: none

Source: architecture review 2026-10-14, candidate 4 ("The Grading policy decides for the clients too", "Worth exploring", in-process). Pairs with candidate 1 (the closest-guess reveal module), which removes the other callers of `isBatchGradedType`.

## Problem Statement

Whether the quiz master can grade an answer right now is decided on the server and guessed again on the client.

- **The server decides.** The Grading policy's hand-grade rule refuses a closest_guess answer until its batch has run, and the answer service enforces that when `GRADE_ANSWER` arrives.
- **The `/control` answers panel guesses.** It decides "this answer is awaiting the batch" by asking whether the question type is batch-graded and the answer has no grade yet. That is a second copy of the rule, written in terms of a grading predicate the panel should not know about. If the policy's rule changes (another batch-graded type, a batch that can be hand-graded early, a mode with a different refusal), the server and the panel disagree and nothing fails to compile.
- **`isBatchGradedType` stands in for two different questions.** In the answers panel it means "can the quiz master hand-grade this answer yet". In the closest-guess reveal and the block reveal views it means "is this revealed step by step". The two happen to be true for the same type today.
- **`gradeAtSubmit` branches on the grading mode outside the Grading policy.** It lives in Scoring and reads the registry's grading mode itself, while the policy's submit table also switches on the mode. A reader looking for "what happens at submit" has to open two modules.
- **Dead exports.** Scoring exports lists and predicates by grading mode (`AUTO_GRADED_TYPES`, `isAutoGradedType`, `isMatchOrHumanType`, and the match-or-human list) that no production code reads. Only tests use them, and they make it look as if grading mode is something callers should branch on.

Quiz masters see no bug today: the panel shows "Graded when the block locks" for a closest_guess answer and the right buttons for everything else. The cost shows the next time a grading rule changes.

## Solution

The `ANSWERS_UPDATED` payload and the admin answer list carry a **grading state** on every answer, worked out by the Grading policy: `graded`, `ungraded` (the quiz master can grade it now) or `awaiting_batch` (it will be graded when its block locks, and can't be hand-graded until then). The answers panel renders the state it is sent and never asks about the question type's grading mode.

`gradeAtSubmit` moves beside the Grading policy, so every rule about what happens to a grade on each grading event sits in one place. The unused grading-mode exports are deleted.

Quiz masters, teams and the big screen see no difference. The panel still shows "Graded when the block locks" for a closest_guess answer before its batch has run, hand-grade controls for every other answer, and the same sort order.

## User Stories

1. As a quiz master, I want a closest_guess answer to show "Graded when the block locks" until the block locks, as today, so that I know there is nothing to grade yet.
2. As a quiz master, I want a closest_guess answer to show the grade buttons once the batch has run, as today, so that I can override a tie or a mistake in the break.
3. As a quiz master, I want a closest_guess answer I overrode before the batch can't exist, as today, so that the batch never overwrites my grade.
4. As a quiz master, I want an answer to an auto-graded question (multiple_choice, sort, match, number) to show its grade and the grade buttons the moment it is submitted, as today.
5. As a quiz master, I want a free_text, audio or YouTube answer that missed the key to show as waiting for my grade, as today, so that I know what is left to do before the break ends.
6. As a quiz master, I want a free_text, audio or YouTube answer that matched the key to show as graded correct, as today.
7. As a quiz master, I want a team that hasn't answered yet to show "No answer yet" with disabled controls, as today.
8. As a quiz master, I want ungraded answers sorted first, then teams that haven't answered, then graded answers, as today, so that the work I need to do is at the top.
9. As a quiz master, I want the panel to update when I grade an answer, when a team revises an answer, and when a live key fix rescores answers, with the right state each time, as today.
10. As a quiz master, I want the panel to show the right state when I reload `/control` mid-block, as today, so that a refresh doesn't hide or invent work.
11. As a quiz master, I want the batch-awaiting state to stay correct after a backend restart that forgot the in-memory summaries, as today, so that I am never offered a grade the batch would overwrite.
12. As a team, I want nothing about my phone to change, since the grading state is only sent to the quiz master's views.
13. As a developer, I want the server to say whether an answer can be graded now, so that the panel renders it and never re-derives it from the question type.
14. As a developer, I want the grading state computed by the Grading policy from the same rule that refuses a hand grade, so that "the panel offers the buttons" and "the server accepts the grade" can't drift apart.
15. As a developer adding a new grading mode, I want the Grading policy's tables to fail typecheck until the new mode says what its answers' grading state is, so that no client has to be updated by hand.
16. As a developer adding a new batch-graded question type, I want the answers panel to need no change, so that a new type doesn't touch `/control`.
17. As a developer reading the Grading policy, I want what happens at submit to be in one module, so that I don't have to read Scoring to follow a submission.
18. As a developer, I want the grading-mode lists and predicates nobody calls deleted, so that the codebase doesn't suggest callers should branch on grading mode.
19. As a developer, I want the answers panel to stop importing grading predicates, so that a grading change can't silently change what the panel draws.
20. As a developer, I want the grading state tested through the answer list a room is sent, so that the test checks what `/control` actually receives.
21. As a developer, I want the panel tested against answer fixtures of each grading state, so that each state's rendering is checked without a running backend.
22. As a developer, I want the glossary to define the grading state, so that the term means the same thing in code, specs and conversation.

## Implementation Decisions

- **New domain term: grading state.** A property of an answer in the admin answer list: `graded` (it has a grade), `ungraded` (no grade yet and the quiz master can grade it now) or `awaiting_batch` (no grade yet and it is graded by its question's batch when the block locks, so it can't be hand-graded). Add it to the glossary. It is not the "Ungraded" glossary entry, which is about an answer or a question still needing the quiz master; the two agree: an `ungraded` answer is one of those, and an `awaiting_batch` answer is not.
- **The admin answer view carries a grading state.** Every answer in the `ANSWERS_UPDATED` payload and in the REST answer list gets it. It is a discriminant the panel switches on, and the existing "is graded" signal on the view (the grading time being set) stays as the source of truth for `graded`. The team's own answer view is unchanged.
- **The Grading policy computes it.** The policy gains one function from a question and a stored answer to a grading state. It reuses the hand-grade rule: an answer with a grade is `graded`; an answer without one is `ungraded` if the question's grading mode allows a hand grade now, and `awaiting_batch` if it does not. The table that decides it is keyed by grading mode, like the policy's other tables, so a new mode fails typecheck until it answers.
- **One answer-to-view mapping.** The answer service maps stored answers to admin answer views in one place, and that place asks the Grading policy for the grading state. Every path that returns an admin answer list (the list for a question, the key-fix regrade, the lock-time batch and the hand-grade refresh) goes through it. The mapping now needs the question's type, so those paths pass the question (or read it with the answers) instead of returning a bare row mapping.
- **`gradeAtSubmit` moves beside the Grading policy.** It stops reading the grading mode inside Scoring. The Grading policy owns "what grade does a submission get the moment it lands", expressed through its submit table, and Scoring keeps what a score is (`scoreSubmission`, the batch grader, the match check). The key-fix rule that asks "would the old key have graded this automatically" calls the relocated function. Its behaviour does not change.
- **The answers panel renders the grading state.** `awaiting_batch` shows "Graded when the block locks" and hides the grade controls; `ungraded` and `graded` show the controls as today. The panel's sort order is unchanged (ungraded first, then no answer, then graded), and `awaiting_batch` sorts as it does today (as a not-yet-graded answer). The panel drops its import of `isBatchGradedType` and no longer reads the question type to decide grading.
- **The question type is still passed to the panel for formatting.** `formatAnswer` and the answer-kind formats stay keyed by type or answer kind; only the grading decision moves.
- **Prune the dead exports.** Delete the auto-graded and match-or-human type lists, `isAutoGradedType` and `isMatchOrHumanType`, and the parity and scoring tests that exist only to pin them. Keep the batch-graded list while a test needs it, and keep `KAHOOT_ALLOWED_TYPES` and `hasMarginType` (they are read).
- **`isBatchGradedType` loses this spec's caller, not necessarily its last.** The remaining callers are the closest-guess reveal's step count and the block reveal views, both owned by candidate 1 (Reveal kind as a registry field). Whichever of the two efforts lands second deletes `isBatchGradedType`.
- **No behaviour change for graded data.** The stored answer, the database schema, the hand-grade refusal and every grading rule stay as they are. This spec moves a decision from the panel to the server and relocates one function.
- **No compatibility shim.** The shared types are used by both apps, which deploy together. Update the socket event schema that describes the answer view with it.
- **Docs to update in the same change:** the glossary (grading state; update the Grading policy entry to say it also decides what a client may grade now) and DOCUMENTATION.md where it describes the answer list or says `gradeAtSubmit` skips batch types. The coding standards line that says the answer and block grading modules ask the Grading policy gains "and the clients are sent its result". `/guide` doesn't change, since nothing the moderator sees changes.

## Testing Decisions

- **A good test checks what a room is sent and what the panel shows, not how the state was computed.** Assert the grading state on the answers a room receives, and the text and controls the panel renders for a given payload. Don't assert which helper decided, and don't spy on the policy.
- **Seam 1: the answer list a room is sent, through the existing backend real-store answer specs.** These already submit answers, grade them and list them. Extend them to assert the grading state:
  - a closest_guess answer is `awaiting_batch` after submit and before the lock, and `graded` once the batch ran
  - a closest_guess answer is never `ungraded`, including after a backend restart that cleared the in-memory summaries and the batch has not run again
  - an auto-graded answer is `graded` the moment it is submitted
  - a free_text, audio or YouTube answer that misses the key is `ungraded`, and `graded` once the quiz master grades it
  - a live key fix that clears an automatic grade turns the answer back to `ungraded`
  - the REST answer list and the `ANSWERS_UPDATED` payload carry the same state
  Prior art: the auto-grading spec, the answer controller spec, the answer service test utilities and the grading-refresh specs.
- **Seam 2: the `/control` answers panel, rendered from payload fixtures in the existing Vitest suites.** Assert:
  - `awaiting_batch` shows "Graded when the block locks" and no grade controls
  - `ungraded` and `graded` show the grade controls, with the selected grade marked for `graded`
  - a fixture whose question type is closest_guess but whose answers are `graded` shows the controls (the panel follows the state, not the type)
  - sort order is unchanged
  Prior art: the answers panel test, the grading live-answers test and the grading quick-point-buttons test.
- **The Grading policy's own pure spec gains the grading-state table and the relocated submit cases.** Every grading mode is asserted for each of graded, no grade and (for batch) before and after the batch, so a new mode shows up as a missing row. The moved `gradeAtSubmit` cases come from the Scoring tests unchanged.
- **Type-level coverage.** The grading state is a union the panel switches on exhaustively, and the policy's table is a record over every grading mode, so a new state or mode fails typecheck until handled. The pre-commit hook and CI already run typecheck.

## Out of Scope

- **The closest-guess reveal and the block reveal views.** Their use of `isBatchGradedType` is candidate 1 (Reveal kind as a registry field).
- **Changing any grading rule.** No new states in the hand-grade rule, no change to when a batch runs, no change to what a key fix overwrites.
- **Attributing grades to a user.** Still an accepted tradeoff in the project guide.
- **The team's own answer view and the phone.** They don't show grading state.
- **Redesigning the answers panel's layout or copy.**
- **The stats module's partial-credit check.** That is candidate 6.

## Further Notes

- The review rated this "Worth exploring": the client rule is one line today. It earns its keep the next time a grading mode or batch-graded type is added, because the compiler then points at the policy instead of at a panel nobody remembered.
- The working tree currently has uncommitted edits to the answers panel (the removed `format-answer-value` pass-through). Build on them or rebase onto them rather than discarding them.
- If the answer service needs the question's type to build the grading state and a path has only an answer row, prefer loading the question reference with the answers over adding a second query per answer.
