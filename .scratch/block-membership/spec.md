# Spec: Block membership is its own rule, and the reveal views are built on it

Status: ready-for-agent

Blocked by: none

Source: architecture review 2026-10-07, candidate 6 ("Separate block membership from the reveal views").

## Problem Statement

Several rules in a live session depend on one question: **which questions belong to the block in play right now?**

- **Grading:** the closest_guess batch at the break, the Grading refresh, the ungraded markers and the break's ungraded reset all cover "the block's questions".
- **The Settle step:** remembering opened questions adds "the block's questions" as the session moves.
- **The answering gate:** whether a team may answer a question, and whether the players view is answerable, depend on "the block's questions".
- **The ended reveal walk and the presenter preview:** these look a question up among "the block's questions".

The only definition of that set is a function that builds **reveal views**. It returns presentation objects with correct answers, closest_guess summaries, round numbers, round-relative question numbers and round titles, and every caller above that only needs question ids builds all of that and throws it away.

Worse, it reads the block from a whole session's progress, so callers that need the block for a *different* progress (the one a press is moving to, or the status the quiz ended from) fake one: they build a copy of the session with its progress swapped and pass that in. Three places do this today (the closest_guess batch, the break's ungraded reset and the opened-questions step), and the ended reveal walk does it with the status swapped.

And a rule written for a view decides a domain question. The reveal view keeps the last block "in play" at `ended`, so the admin can still review its answers after the reveal finishes. That same choice is what makes grading, the Grading refresh and the ungraded markers work at `ended`. Nobody decided that for grading; it follows from a comment about the admin's review panel.

The result is that a change to how reveal views look (a new field, a different numbering) touches the code that decides grading and answering, and a reader trying to learn "what's in the block" has to read through view-building code to find out.

## Solution

**Block membership** becomes its own small, pure module. It's given the quiz's rounds and a progress (no session), and it answers which questions belong to the block in play: their positions and ids. It's the one place that states the rule:

- **While answering** (a question open or locking, or a round intro over already opened questions), the block in play is the current block up to its furthest opened question. Previous never hides a question already opened.
- **Once the block has locked** (break, reveal and their intro cards), it's the whole just-locked block.
- **At `ended`**, it's the last block played, up to where progress stands. That's what lets the admin keep reviewing and grading its answers. This is now a named, tested case of the rule, not something a view happens to do.
- **In every other status** (lobby, rules, round overview), it's empty.

Grading, the Settle step and the answering gate ask the Block module directly, with whichever progress they mean, so no caller fakes a session. The reveal views (block questions, reveal questions, the ended reveal walk, the presenter preview's lookup) are built on top of it: they take the block's positions and dress them with answers, summaries, numbers and titles.

Nothing changes for anyone in the room. Every view, gate and grading result is exactly what it is today.

## User Stories

1. As a quiz master, I want the closest_guess batch at the break to grade exactly the questions of the block that just locked, so that every closest_guess guess in it is scored.
2. As a quiz master, I want the ungraded markers in the break to cover exactly the block that just locked, so that "nothing left to grade" means the whole block is graded.
3. As a quiz master, I want to keep reviewing and grading the last block's answers after the quiz has ended, so that I can still fix a grade before the final standings are read out.
4. As a quiz master stepping back with Previous during a block, I want questions already opened to stay answerable and gradable, so that stepping back on the big screen doesn't take anything away from teams.
5. As a team, I want to be able to answer exactly the questions of the current block that have been opened, so that I can't answer ahead and I don't lose questions already shown.
6. As a team in a kahoot round, I want each question to be its own block for answering and grading, so that kahoot scoring works one question at a time.
7. As a team in a block that spans several rounds, I want every opened question across those rounds to stay answerable until the block locks, so that a round change inside a block doesn't lock earlier questions.
8. As a team whose phone reconnects at `ended`, I want the final block's reveal walk to be the same as before, so that my answer history stays intact.
9. As a quiz master on `/remote`, I want the presenter preview to name the same question as before, so that the "next" line stays right.
10. As a developer, I want to ask "which questions are in the block in play for this progress?" without building a session, so that grading and settling can ask it for the progress they're moving to.
11. As a developer, I want the answer to be ids and positions, not reveal views, so that callers that only need membership don't build answers and summaries they throw away.
12. As a developer, I want the rule for `ended` stated in the Block module, so that whether grading works at `ended` is a decision, not a side effect of the admin's review panel.
13. As a developer changing how reveal views look, I want to change only the view code, so that grading and answering can't break as a side effect.
14. As a developer reading the Grading refresh, I want it to say "the block in play" through one call, so that its scope is obvious.
15. As a developer reading the Settle step, I want opened questions to come from the Block module and the past blocks, so that "opened" is plainly "everything up to the furthest point reached".
16. As a developer, I want the Block module to be pure and table-tested across a whole quiz walk, so that the rule is pinned by examples anyone can read.
17. As a developer, I want no call site to copy a session just to swap its progress, so that there's no way to accidentally pass the wrong progress's leftovers (timers, summaries) along.
18. As a developer working on the grading policy later, I want the block's scope to be a small interface already, so that moving the regrade policy doesn't drag view code with it.

## Implementation Decisions

- **A new Block module in the backend's live session state**, pure, with no session, database or view types in its interface. It takes the seeded quiz's rounds (or the game context plus rounds) and a progress, and returns the block in play as an ordered list of positions (round index, question index), with the question id for each. A convenience for "just the ids" is part of the interface, since most callers only need that.
- **The rule, as above:** furthest opened question while answering, the whole block once locked, the last block played up to the current position at `ended`, empty otherwise. It reuses the shared block position helpers (block start, block position of a question, walking forward from a block start) and the status groups. No new status group is needed. The `ended` case is its own branch with its own comment and tests.
- **Callers switch to it:**
  - **Grading:** the closest_guess batch, the Grading refresh's scope, the ungraded markers for the block and the break's ungraded reset ask the Block module with the progress they mean (the new progress for a press, the session's own otherwise). No session copies.
  - **The Settle step:** opened questions are the session's earlier opened questions, plus the past blocks' questions, plus the Block module's ids for the progress being moved to.
  - **The answering gate:** whether the block is answerable, and whether one question is open for answering, read membership from the Block module.
- **The reveal views are built on the Block module.** The function that builds the block's reveal views takes the Block module's positions and dresses each one with its question, its closest_guess summary (for batch-graded types), its round number, its question number in its round and its round title. Block questions (answer-free) and reveal questions keep their current status windows on top of that. The ended reveal walk passes the status the quiz ended from as a progress to the Block module, not as a faked session. The presenter preview's lookup uses the views as today, since it needs the answer.
- **Past revealed questions stay as they are.** Their rule ("every block before the current one") is already independent of the reveal view, and the Settle step keeps using it.
- **Behaviour-preserving.** Same ids, same order, same views, same gate, same grading in every status, including the `ended` and Previous cases. No protocol, schema or database change.
- **Docs, in the same change:**
  - `GLOSSARY.md` gains **Block in play**: the questions of the current block a session has reached. While answering, it's those up to the furthest opened one; once the block locks, the whole block; at `ended`, the last block played. Grading, the answering gate and opened questions all cover the block in play.
  - `CODING_STANDARDS.md`'s game-state section gains: "Ask the Block module which questions are in the block in play for a progress; never build a session copy with a swapped progress to ask a view function."
  - `docs/architecture.md` adds the Block module if its live-session diagram lists the block questions helper.

## Testing Decisions

- **Seams (agreed with the user):** one new seam, the pure Block module, plus the existing specs as the safety net, unchanged.
- **A good test gives the Block module rounds and a progress and checks the ids and positions it returns.** Nothing about how it computes them, and no session, database or socket. Tests are tables over a quiz walk:
  - a quiz with two blocks (one spanning two rounds), a kahoot round and a final round;
  - every status from lobby to ended;
  - Previous stepping back inside an open block (the furthest opened position is kept);
  - a round intro reached by Advance into a fresh round versus one reached by Previous;
  - a fresh block with nothing opened;
  - `ended` after the reveal, and `ended` pressed mid-block (pinning today's result, see Further Notes).
- **Prior art:** the existing block questions, opened questions and past revealed questions specs (pure functions over a session walk), the shared types state-machine tests (table-driven walks) and the walk test utilities in the game test folder.
- **Equivalence while migrating:** before any caller moves, a test walks the shared quiz through every status and Previous step and asserts the Block module's ids equal the ids of today's reveal-view function for the same progress. It's deleted once every caller has moved and the old function is gone (or kept, if the view function still exists, as a check that the views are built on the module).
- **Safety net, unchanged:** the block questions, opened questions, grading gate, grading, ungraded agreement, ungraded restore, last-second answer, kahoot answer gate, players view, players reveal redaction, past revealed questions, screen projection and presenter context specs all pass without edits.

## Out of Scope

- Changing what the block in play is at `ended` (for example when End Quiz is pressed mid-block). This spec only names and pins today's rule.
- The grading policy move (review candidate 7): regrades and pairing the Grading refresh's calls. This spec only gives it a narrow scope to call.
- Upcoming question positions and the furthest-open position helper. They already work from positions and stay as they are, though they may reuse the Block module's internals if that's simpler.
- Any change to the reveal views' shape or to the players view's trimming.
- Moving the Block module into shared types. The frontend doesn't need it today.

## Further Notes

- **The `ended` edge case.** Today, if End Quiz is pressed mid-block, the block in play at `ended` runs only up to the question on screen, not the furthest opened one, because the locked-block branch reads the current position. So an answer to a question opened before Previous stepped back would fall outside grading's scope at `ended`. This spec keeps that behaviour and pins it in a test. Whether to widen it is a decision for a follow-up, and with the Block module it becomes a one-branch change.
- This makes candidate 7 (grading policy in one module) easier: the Grading refresh's scope is one call with an explicit progress.
- A natural ticket order:
  1. the Block module with its tables and the equivalence test;
  2. move grading and the Settle step onto it;
  3. move the answering gate and the views onto it, delete the session copies, add the docs.
