# Spec: One Round identity rule for a live edit

Status: done

Source: architecture review 2026-11-21, candidate 3 ("One rule for which round a live edit leaves a round in").

## Problem Statement

During a live session, the quiz master can still edit the quiz past the **Live-edit frontier**: add, delete, reorder and move questions and rounds. Teams hold things that point at a round: a **Joker**, and any **Extra joker** they bought. After a save those must still point at "the same round", even when the round's row is deleted and its questions now sit in another row, or the rounds are reordered.

The app answers "which round is the same round now" with one rule (a round is known by its questions: after the edit, it's the round holding most of the questions it held before, or gone when none is left), but the rule is written twice:

- **Before the save**, the live-edit guard predicts where every doubled round will land, to refuse a save that would put a Clue question on a round a team doubles (a Clue round can never be doubled). Its version works on the incoming save's rounds and reports "none" as an index of −1.
- **After the save**, the jokers move with their own version, which works on the reloaded game's rounds and reports "none" as null. The extra jokers borrow that same version from the joker module, though the rule belongs to neither of them.

The two only agree because both happen to pick the first round on a tie and both treat an empty round as gone. If one of them changes (say, a tie broken by position, or by fewer added questions), the guard checks one round while the joker lands on another. Then a save the guard let through puts a joker on a Clue round. That breaks the "a Clue round is never doubled" rule live on stage, and nothing would catch it, because each half is only tested on its own. The rule has no name in GLOSSARY.md either, so whoever changes one half has no reason to look for the other.

## Solution

One **Round identity** module answers "which round is this round after the edit". The live-edit guard, the jokers and the extra jokers all ask it. The guard's prediction and the jokers' move then can't drift apart. The tie and gone cases are decided, and tested, in one place, and the rule gets a GLOSSARY.md entry.

For the quiz master and the teams nothing changes. Saves that are refused today are still refused, and jokers and extra jokers land exactly where they land today.

## User Stories

1. As a quiz master, I want a joker to stay with its round when I reorder the rounds after the frontier, so that the team's doubled round doesn't change under them.
2. As a quiz master, I want a joker to follow its round when I move the round's questions into another row, so that deleting and re-adding a row doesn't lose the team's choice.
3. As a quiz master, I want a joker whose round I deleted outright to be drawn again from the rounds that can still be doubled, so that every team still holds one (as today).
4. As a quiz master, I want an extra joker to follow its round the same way a joker does, so that what a team paid for still counts double.
5. As a quiz master, I want an extra joker whose round is gone to be removed and its cost handed back, so that no team pays for nothing (as today).
6. As a quiz master, I want a save refused when it would put a Clue question on a round some team doubles, so that a Clue round is never doubled.
7. As a quiz master, I want that refusal to check exactly the round the joker would land on, so that a save it lets through never leaves a joker on a Clue round.
8. As a quiz master splitting a doubled round's questions evenly between two rounds, I want the guard and the joker to agree on which one is the doubled round, so that a Clue question in the other one is allowed and a Clue question in that one is refused.
9. As a quiz master, I want new questions I add to a round not to count towards which round it is, so that adding questions never moves a joker.
10. As a quiz master, I want a round that keeps none of its questions to count as gone, both for the refusal and for the joker, so that the two never disagree about an emptied round.
11. As a quiz master, I want a save that changes nothing about the doubled rounds to leave every joker and extra joker where it was, so that saving a typo fix is harmless (as today).
12. As a team, I want my phone's doubled rounds to match the rounds the server scores double after a live edit, so that I'm not told the wrong round counts double.
13. As a team, I want to be told when our joker was redrawn because its round is gone, so that we know where it went (as today).
14. As a team that bought an extra joker, I want it to stay on the round I chose when the quiz master tidies up later rounds, so that my coins aren't wasted.
15. As a developer, I want one place that decides which round a round became, so that a change to the tie rule changes the guard and the jokers together.
16. As a developer, I want the rule named in GLOSSARY.md, so that whoever touches the guard or the jokers finds it.
17. As a developer, I want the extra jokers not to import a rule from the joker module, so that each change module depends only on what it uses.
18. As a developer, I want the tie, gone and new-question cases tested once at the rule, so that I don't have to stage a whole live session to check them.
19. As a developer, I want one end-to-end check that the guard and the joker agree on a tie, so that the promise "a save the guard lets through never doubles a Clue round" is pinned where it matters.

## Implementation Decisions

### The Round identity module

- A new backend module, database-free, holds the rule: given the questions a round held before the edit, and the rounds after it (each as its list of question ids, where a newly added question has no id yet), it returns which round after the edit is that round, or none.
- **The rule, unchanged from today:** the round holding the most of the earlier round's questions. On a tie, the first such round in quiz order. None when no question is left, which includes a round that had no questions. New questions (no id) never count.
- It returns a position in the rounds it was given (or none). Each caller maps that to what it needs (an index in the incoming save, or a round id in the reloaded game), so the same rule serves both shapes of rounds.

### Callers

- The live-edit guard's check for Clue questions on doubled rounds asks the Round identity module where each doubled round lands in the incoming save. Its own copy of the rule is deleted.
- The jokers' follow after a live edit asks the Round identity module where each joker's round landed in the reloaded game. Its own copy of the rule is deleted. What happens next stays the same: the joker moves, is redrawn when its round is gone or landed on one of the team's extra joker rounds, and the team is told.
- The extra jokers' rebuild after a live edit asks the Round identity module directly, instead of importing the joker module's copy. Dropping a gone extra joker, and dropping a second one of the same team on the same round, stay as they are.

### Docs

- `GLOSSARY.md`: add **Round identity**: across a live edit, a round is the round now holding most of the questions it held (the first one on a tie). It's gone when none of them is left, and newly added questions don't count. Jokers and extra jokers follow it, and the live-edit guard predicts with it. Put it near **Live-edit frontier**.
- `DOCUMENTATION.md`: the live-edit paragraph that says "a round is known by its questions" names **Round identity** and its tie rule.
- No change to what the moderator sees, so `/guide` stays as it is.

## Testing Decisions

Good tests here assert what a save does: refused or accepted, and where each joker and extra joker ends up. They don't assert which module computed the round.

- **The Round identity module, through its interface, database-free** (inside the backend's database-free mutation slice): the round holding most questions wins; a tie goes to the first round; a round with none of its questions left is gone; a round that had no questions is gone; new questions without ids don't count; a reorder finds the round at its new position; the questions moved into a fresh row are found there.
- **The live edit save, end to end with the real Postgres store** (the existing live-edit save specs): add a case where a doubled round's questions are split evenly between two rounds. A Clue question added to the first of them is refused. A Clue question added to the second is accepted, and afterwards the joker sits on the first round. That's the one test that pins "the guard checks the round the joker lands on". The existing joker and extra joker follow cases (reorder, row deleted with its questions moved, round gone, two extra jokers on one round) keep passing unchanged. Prior art: the played-quiz edit, extra joker live edit and joker one-per-team specs.
- The live-edit guard's existing Clue-on-doubled-round cases keep passing unchanged. They now exercise the shared rule through the guard.
- Run `pnpm crap:changed`, the backend database-free mutation run for the Round identity module and the guard, and the `mutate:db` run for the joker and purchase change modules, before closing.

## Out of Scope

- Changing the rule itself (another tie-break, weighting by position). This spec only makes it one rule.
- Other things keyed by a round id that a live edit could orphan: round ratings, round notes, bonus awards' blocks. Whether they should follow Round identity is a separate question.
- The other candidates from the 2026-11-21 review ([team-view-held-once](../team-view-held-once/spec.md), [answer-list-module](../answer-list-module/spec.md), [scoring-records](../scoring-records/spec.md), [bonus-award-policy](../bonus-award-policy/spec.md), [selected-question-view](../selected-question-view/spec.md)).
- Any change to which live edits are allowed (ADR 0002 and the Live-edit frontier stand).

## Further Notes

- ADR 0002 (live structural edits after the opened prefix) and ADR 0004 (joker doubling is derived, not stored) are upheld: the rule only says which round a stored joker or extra joker points at after an edit.
- The guard's refusal and the joker's move run in the same save, inside the live sessions' writes, so the round set the guard predicts on is the one the reload produces. This spec relies on that, and doesn't change it.
