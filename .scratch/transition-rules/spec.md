# Spec: One transition rules module for what a move between statuses sets off

Status: ready-for-agent

Blocked by: team-view-projection. Both rework the move's outcome; once team views land, "grades become visible" and "leaves the lobby" only add changed team ids, and this spec builds on that.

Source: architecture review 2026-11-18, candidate 2 ("Move status-transition effects into one module").

## Problem Statement

Some moves from one status to another set things off, beyond changing what's on air:

- leaving the joker pick draws jokers for teams without one, and entering it again clears drawn jokers;
- leaving the lobby decides carried coins;
- Start quiz with Versus on is refused while a team has no side;
- leaving a break with Advance is refused while the block has ungraded answers;
- a quickfire question leaving locking is speed-scored;
- reaching a graded or revealing status batch-grades the block's closest-guess questions;
- three different moments make grades visible to the teams;
- entering or leaving ended changes league tables;
- the screen preview words the Early answer reveal's break exit differently.

Those rules are decided in five places: the move pipeline, block grading, the session outcome's reveal-entry check, the session write's league report, and the screen preview. Each combines the shared status predicates in its own way. The predicates themselves are unit-tested, but the bugs come from the combinations. Adding the Early answer reveal statuses (ADR 0006) touched four of those places in a 25-file change, and still shipped a bug: teams didn't get their grades when a break was left into the results. That was fixed later in the reveal-entry check alone.

For the developer, adding or changing a status means finding every place that reacts to it, with no list of where they are. A combination can only be checked through database-backed socket specs, so walking every status pair is too slow to do.

## Solution

One **transition rules** module answers the question "what does this move set off?". Given the session before a move, the progress after it, and the press (or timer) behind it, it returns a set of named **transition facts**. The move pipeline, block grading, the league report and the screen preview read those facts instead of combining status predicates themselves.

The modules that carry out an effect stay where they are (jokers, carried coins, grading). Only the decision of when each one runs moves.

For the quiz master and the teams nothing changes. For the developer, a new status means one edit in one module, checked by a fast table test that walks every status pair.

## User Stories

1. As a quiz master, I want teams without a joker to be given a drawn one when I leave the joker pick by any route, so that every team has a doubled round.
2. As a quiz master, I want going back into the joker pick to clear drawn jokers, so that those teams can really choose.
3. As a quiz master, I want carried coins decided exactly once, when the quiz leaves the lobby, so that a team's coin balance is right from the first round.
4. As a team that joined in the lobby, I want my coins updated when the quiz leaves the lobby, so that I see the carried coin I earned.
5. As a quiz master running Versus, I want Start quiz refused while a team has no side, so that every team plays for a side.
6. As a quiz master, I want End quiz to work in the lobby even with Versus on and teams without sides, so that I'm never stuck.
7. As a quiz master, I want Advance out of a break refused while the block has ungraded answers, so that no reveal shows unfinished scores.
8. As a quiz master, I want Previous and End quiz out of a break not to be refused for ungraded answers, so that I can always back up or finish.
9. As a quiz master, I want the ungraded check on leaving a break to read the database, so that a restart's stale cache can't let ungraded answers through.
10. As a quiz master, I want a refused move to write nothing, so that a refusal never leaves the session half-moved.
11. As a quiz master running a quickfire quiz, I want each question's points rescaled by answer speed when it leaves locking, so that faster teams score more.
12. As a quiz master, I want going back into locking and advancing again to give the same quickfire points, so that Previous can't change scores.
13. As a quiz master, I want closest-guess questions graded once the block reaches a graded status, so that the reveal can show who was closest.
14. As a quiz master with Early answer reveal on, I want closest-guess questions graded when the answers air before the break, so that the early reveal's closest-guess steps work.
15. As a quiz master, I want /control's answer list refreshed for questions the batch just graded, so that I don't see ungraded rows for graded answers.
16. As a team, I want my grades to reach my phone on entering reveal intro, so that I see how we did as the reveal starts.
17. As a team in a quickfire quiz, I want my grades to reach my phone on the collapsed lock-to-reveal, so that the speed-scored points show.
18. As a team with Early answer reveal on, I want my grades to reach my phone when the quiz leaves a break into the results, so that the verdicts appear under the leaderboard.
19. As a team, I don't want my grades sent at any other move, so that nothing is shown before the moment it's meant to air.
20. As a league organiser, I want the league tables of other live sessions refreshed when a session enters or leaves ended, so that the league top they show is current.
21. As a league organiser, I want a grade, bonus or showdown result after the end to refresh league tables, so that late fixes count.
22. As a quiz master, I want the screen preview for leaving a break with Early answer reveal on to say "Results, then …", so that I know the board comes before the next round.
23. As a quiz master, I want the screen preview and the real press to agree on what a move sets off, so that the preview never says one thing while the press does another.
24. As a quiz master, I want an auto-lock by the timer to set off the same effects as pressing Advance, so that a timed block behaves like a manual one.
25. As a developer adding a status, I want one module listing what every move sets off, so that I make one edit instead of finding five places.
26. As a developer, I want a fast table test that walks every status pair and press, so that a combination bug shows up without a database.
27. As a developer, I want each fact named in the domain's words, so that a reader can see from the name what a move sets off.
28. As a developer, I want the move pipeline's fixed order kept (gates before writes), so that the refactor changes no behaviour.
29. As a developer, I want the screen preview to read the same facts as the move pipeline, so that the early-reveal break-exit rule is stated once.

## Implementation Decisions

### The transition rules module

- A new pure module in the backend game state area. Its input is the session before the move, the progress after it, and the press (Advance, Previous, Start quiz, End quiz, the leaderboard toggle; the timer's auto-lock arrives as Advance). Its output is a plain record of **transition facts**. It does no database reads and no writes.
- The facts, named in the domain's words:
  - **Joker pick closes**: leaving the joker pick by any route. **Joker pick reopens**: entering it from anywhere else.
  - **Leaves the lobby**: carried coins are decided, and every team's coins may change.
  - **Start needs every side**: Start quiz from the lobby with Versus on.
  - **Leaving the break needs the block graded**: Advance on a break exit.
  - **Quickfire question is speed-scored**: leaving locking while the round in play is quickfire.
  - **Block is graded**: the move reaches a graded or revealing status.
  - **Grades become visible**: entering reveal intro, quickfire's collapsed lock-to-reveal, or a break exit into a non-revealing status (the Early answer reveal's results). It replaces the session outcome's reveal-entry check.
  - **Leaves the break into results**: a break exit that doesn't go to reveal intro; the screen preview words it as "Results, then …".
  - **League tables may change**: entering or leaving ended.
- Built from the shared status-group predicates, which stay in shared types unchanged. ADR 0006's statuses and groups are untouched.

### Who reads the facts

- **The move pipeline** works out the facts once per move and passes them to each step. Its fixed order stays: gates first (every side, block graded), then the joker pick crossing, carried coins, grading, settle, save. A refused move still writes nothing.
- **Block grading's** move entry takes the facts instead of re-deriving the break-exit, locking-exit and graded-status conditions. Grading at placement (creation and restart restore) is not a transition; it keeps its own entry and is out of scope.
- **The session outcome** loses its reveal-entry check. The move pipeline lists every team as changed when *grades become visible* and when *leaves the lobby*, using the changed-team-ids contract from team-view-projection.
- **The session write's league report** takes its status part from *league tables may change*. The "ended before and after, and standings refreshed" check stays in the session write, because it depends on the standings result. Writes that aren't moves have no transition, so the status part is false for them.
- **The screen preview** reads *leaves the break into results* for its wording instead of restating the rule.

### Behaviour

- No behaviour change. Every effect fires on exactly the moves it fires on today.

### Docs

- `GLOSSARY.md`: add **Transition fact**: a named consequence of a move between two statuses (for example "grades become visible"), decided in one place.
- `DOCUMENTATION.md`: where the statuses section lists what moves set off, point to the transition facts and use their names. No protocol change.
- Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

- Good tests assert which facts a move produces, and what a move really does through the socket. They don't assert which step reads a fact or in what internal order.
- **New seam: the transition rules module, without a database.** A table test walks every from-status × to-status pair the state machine allows, for each press, with quickfire on and off, Early answer reveal on and off, and Versus on and off. It asserts the full fact record. Hand-written cases pin each fact's edges: Previous and End quiz out of a break don't need the block graded; End quiz in the lobby doesn't need sides; going back into locking and out again speed-scores again; only the three reveal moments make grades visible.
- Prior art: the shared forward, backward and Early answer reveal transition tests, which already walk status pairs with the state machine.
- **Existing seam: the socket interface with the real Postgres store.** The existing specs keep proving the effects really happen: the joker draw at pick close, carried coins, the ungraded refusal, the Versus start refusal, the quickfire rescale, the closest-guess batch, grades reaching phones, and league tables refreshing. No new specs here; fix only the ones the refactor breaks. A spec that has to change its expectations shows a behaviour change and is a bug in the refactor.
- Screen preview tests: the "Results, then …" wording still shows for the Early answer reveal's break exit.
- Run `pnpm crap:changed`, and `pnpm --filter backend mutate:db` for the transition rules module and the move pipeline. The table test should kill every mutant in the transition rules module without the database.

## Out of Scope

- Grading at placement (creation and restart restore).
- Moving the effects themselves (joker draw, carried coins, grading) into the transition rules module.
- Changing any status, status group or shared predicate (ADR 0006 stands).
- Collapsing the game state and gateway pass-through modules (architecture review candidate 3).
- Live edits, timers and deadline reports, beyond the timer's auto-lock reading the same facts through the move pipeline.

## Further Notes

- The "league tables may change" fact covers only the status part. A reader looking for every league refresh still needs the session write's standings check; its doc comment should point to the fact.
- If a later status needs an effect that depends on database state (as "block graded" does), the fact should still say only *that* the check is needed. The read stays with the module that owns the data.
