# Spec: One dry-run press for the Quiz preview and the presenter preview

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 2 ("Strong", in-process).

## Problem Statement

Two things in the app ask "what would the big screen show after the next press?" without pressing anything:

- the **presenter preview**, the "next" line on /remote;
- the **Quiz preview**'s "like the night" order, which walks a saved quiz's display screens by pressing Advance over a session with no teams.

They answer it in two different ways.

- **The presenter preview** uses Commit a move's dry run: the Move plan, then the real **Settle step**, which brings the timers, the deadlines, the opened questions, the leaderboard reveal count and the Stepped reveal's step into line with the new point in the quiz.
- **The Quiz preview** has its own hand-written press. It asks the Move plan, then copies across only the new progress (or adds one to the leaderboard reveal count, or takes the Stepped reveal's step), and skips the Settle step altogether. During the walk the session's opened questions never grow, its reveal step is never restarted when a new reveal comes on air, and its leaderboard reveal count never resets.

The Quiz preview's own test checks it against a third hand-written copy of the same press. If the two copies drift together, the test still passes.

Nothing users see is wrong today, but only by luck. The Quiz preview has no teams, so every closest-guess reveal has one step, a stale reveal step never shows, and the leaderboard is left out of the preview. That luck runs out as soon as the projection reads a field only the Settle step keeps right, or a Stepped reveal gains steps that don't depend on teams. Then the Quiz preview would show staff a night that differs from the real one, which is exactly what it exists to rule out. Each recent Stepped reveal change has already had to touch the preview's press too.

The Settle step is pure: it takes the time as an argument and reads nothing else. It still lives in the backend next to Commit a move, so shared types (where the Quiz preview, the Move plan and the Stepped reveal live) can't call it.

## Solution

The Settle step and the presenter preview's dry-run press move into shared types, beside the Move plan. The Quiz preview walks its "like the night" order with that same dry-run press, and its hand-written press is deleted. One dry-run press then serves:

- the presenter preview's "next" line;
- the Quiz preview;
- (through the same Settle step) every real press Commit a move carries out.

The Quiz preview can no longer show a night that differs from what pressing Advance does live.

The Quiz preview's "same screens as a real session" check moves to the backend. It compares the preview of a seeded quiz with the display screens a real session reaches when the quiz master presses Start quiz, then Advance, on the real stores. The check no longer relies on a copy of the code it is checking.

Users should see nothing different. The Quiz preview's screens, in both orders, and /remote's "next" line stay exactly as they are.

## User Stories

1. As a quiz author, I want the Quiz preview's "like the night" order to step through the same screens a real session reaches by Advance, so that what I check before the night is what the room will see.
2. As a quiz author, I want the "like the night" order to stay right when a reveal changes how it steps, so that a future reveal change can't make the preview and the night disagree.
3. As a quiz author, I want each closest-guess reveal in the preview to start from its first step, so that a reveal following another never starts part-way through.
4. As a quiz author, I want the preview's screens unchanged by this work, in both orders, so that nothing I've learned to expect moves.
5. As a quiz author, I want the preview still to leave out lobby, rules, join overlay, locking, break review, break round title, leaderboard, showdown and ended, so that it shows only quiz content.
6. As a quiz author, I want the preview's break intro still to carry no deadline, no feedback prompt and no fun facts, so that it shows nothing that belongs to a live night.
7. As a quiz author, I want a round with no questions still shown as its title card in front of the next round, so that the preview never fails on an unfinished quiz.
8. As a quiz author, I want the preview to keep its round numbering when a round has no questions, so that "Round 3" in the preview is Round 3 on the night.
9. As a quiz author, I want the preview to stay a read that plays, stores and counts nothing, so that opening it never touches a live session or the database.
10. As a quiz master, I want /remote's "next" line to keep describing the session as my next press will leave it, so that I know what the room will see before I press.
11. As a quiz master, I want the "next" line to come from the same dry-run press as the Quiz preview, so that the two can never describe a press differently.
12. As a quiz master, I want every real press (Advance, Previous, the auto-lock and kahoot timers, Start quiz) settled exactly as today, so that this work changes nothing on the night.
13. As a quiz master whose backend restarted, I want my session restored exactly as today, so that moving the Settle step doesn't change restore.
14. As a developer changing the Settle step, I want one copy of it that both previews and every real press go through, so that a change can't reach one and miss another.
15. As a developer adding a Stepped reveal, I want to supply only its descriptor, without also teaching the Quiz preview how to step it, so that a new reveal is one change.
16. As a developer, I want the Settle step's phase timer and leaderboard reveal count rules tested where they live, in shared types, so that their tests sit next to the Move plan's.
17. As a developer, I want the Quiz preview's "same screens as a real session" test to compare against a real session on the real stores, so that it would catch a preview that drifts from the live press.
18. As a developer, I want no hand-written copy of the press left in the Quiz preview or its tests, so that there is exactly one dry-run press to keep right.
19. As a developer, I want the dry-run press to take the time as an argument, so that both previews and their tests are deterministic.
20. As a developer reading the glossary, I want Commit a move and Quiz preview to say they share one dry-run press, so that the terms match the code.

## Implementation Decisions

### The Settle step moves to shared types

- The Settle step moves from the backend into shared types, beside the Move plan, with the helpers only it uses: the phase timer fields and the leaderboard reveal count.
- Its interface is unchanged: given the session, the progress it is moving to, the kind of step (a planned press with the action it is carried out as, or placing a session), the time, and on restore the saved phase timer, it returns the session with every progress-dependent field settled.
- The fields it settles, and their order, are unchanged:
  - the phase timer first;
  - then the opened questions, the question lock, the kahoot question deadline, the break end, the leaderboard reveal count and the reveal step.
- It stays pure and reads no clock.
- The backend keeps no copy. Commit a move (presses, session creation and restart restore) and the presenter preview import it from shared types.

### One dry-run press in shared types

- The presenter preview's dry-run press moves to shared types beside the Move plan, together with the step that settles a planned press as the action it plans.
- **Interface:** given a session, an action and the time, it returns the planned move step and the session as the press would leave it. It never grades, never resolves a showdown, never saves, and never changes the session it was given.
- It differs from today in one way: it takes the time as an argument instead of reading the clock. The presenter preview passes the current time. Commit a move's real press keeps settling with the current time through the same settle step.
- For a step that doesn't move the quiz (waiting for grading, a showdown waiting for guesses, blocked), it returns the session unchanged with that step, as today.

### The Quiz preview walks with it

- The "like the night" walk presses the next press (the Move plan's "next press": Start quiz in the lobby, Advance everywhere else) through the shared dry-run press.
- It stops at the end of the quiz, or on any step that doesn't move the quiz, as it does today when its own press returns nothing.
- The walk passes a fixed time. Nothing the preview shows reads a deadline:
  - the locking screen, which carries the lock time, is left out;
  - the break intro's end time stays empty, because the walked session never has one set.

  So the screens can't depend on the time chosen.

- The preview's hand-written press is deleted.
- Everything else about the Quiz preview stays as it is:
  - the screen kinds kept;
  - the renumbering around rounds with no questions;
  - the break intro's empty feedback prompt;
  - the host-only text;
  - the `answer_after_question` order, which doesn't walk presses at all.

### Docs, in the same change

- **GLOSSARY.md:**
  - **Commit a move:** the presenter preview and the Quiz preview's "like the night" order are both dry-run commits through the same dry-run press, using the same plan and Settle step.
  - **Quiz preview:** its "like the night" order is walked by that dry-run press.
- **DOCUMENTATION.md:** the Quiz preview's `night` paragraph says the order is a dry run of the real press, the Move plan and the Settle step, over the team-less session, not only of "the real Advance plan".
- **docs/architecture.md:**
  - say the Settle step lives in shared types with the Move plan, and Commit a move calls it;
  - update any diagram that places it inside the backend.

## Testing Decisions

- **What makes a good test:** it drives a module through its interface and checks what comes out: screens, sessions, figures. It never asserts on which helper ran or copies the code under test into the test as its oracle.
- **The Quiz preview vs a real session** is the main new test: a backend real-store gateway spec, using the existing seam, with no new one.
  - It seeds a multi-block quiz with:
    - a plain round;
    - a kahoot round;
    - a round that doesn't break after it;
    - a closest_guess question;
    - and, in a second case, a round with no questions.
  - It drives the seeded session with Start quiz and then Advance until the end, reading the display view's screen after each press (no teams joined, so nothing waits for grading).
  - It asserts that the Quiz preview of the same quiz, in the `night` order, has exactly the screen kinds the live session showed, minus the left-out kinds.
  - It also asserts that the live run passed through kinds the preview leaves out, so the filter is real.
- **The shared Quiz preview spec:** its "kind for kind like a real session" case and the hand-written press helper it used as its oracle are deleted, since the backend spec replaces them. Every other case passes unchanged:
  - the block order;
  - the left-out kinds;
  - the break intro's empty deadline, feedback prompt and fun facts;
  - block ends;
  - positions;
  - empty quizzes and rounds with no questions;
  - renumbering;
  - the `answer_after_question` order;
  - host-only text.
- **The Settle step's helper specs** (the phase timer and the leaderboard reveal count) move with their modules from the backend's Jest suite to shared types' Vitest suite, with their cases unchanged.
- **Backend specs that pass unchanged:**
  - the Commit a move spec;
  - the presenter context spec (the "next" line);
  - the phase timer, join overlay, Previous-to-lobby and action availability specs;
  - every real-store spec that presses through a session.
- **Prior art:**
  - the presenter context and Commit a move specs on the real-store harness, for driving a session and reading a room's view;
  - the shared Quiz preview spec, for preview fixtures;
  - the existing phase timer and leaderboard reveal specs, which move as they are.
- **E2E:** run `pnpm e2e` once before the PR. No new journey: the Quiz preview and /remote journeys already cover both previews.

## Out of Scope

- **Host-only text:** the Quiz preview's host-only text rule (which screens carry the round note and question notes) and its disagreement with the presenter context. That is architecture review candidate 4, a separate spec.
- **The left-out screen kinds:** any change to which screen kinds the Quiz preview keeps, or to its `answer_after_question` order.
- **Grading and showdown in the dry run:** grading, showdown resolve and saving stay with Commit a move. They do not move to shared types.
- **The rest of Commit a move:** what stays with Commit a move itself (the grading step, the save, the outcome it hands the Session broadcaster, and placing a session through the Live results read).
- **Real-press timing:** any change to when a real press reads the clock, or to how the phase timers are armed.

## Further Notes

- Confirmed with the user on 2026-10-21:
  - the Quiz preview's "same screens as a real session" check uses a real session on the real-store harness as its oracle, not the shared dry-run press;
  - its shared copy of the press is deleted.
- This is a behaviour-preserving refactor. Any change to a Quiz preview screen or to /remote's "next" line after it ships is a bug.
- The Settle step keeps reading the session's Live results (the leaderboard) for the leaderboard reveal count. In the Quiz preview that leaderboard is empty, so the count stays 0, which is fine because the preview leaves the leaderboard out.
