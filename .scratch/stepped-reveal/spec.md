# Spec: One stepped reveal for the showdown and the closest guess

Status: ready-for-agent

Blocked by: none. `display-screen-sounds` 01 (screen position) also edits the On-air screen and the screen projection. Neither depends on the other; whichever lands second rebases.

Source: architecture review 2026-10-20, "Out of Scope, revisited", candidate 4. `closest-guess-reveal-module` and `reveal-kind` both deferred this item.

## Problem Statement

Two reveals walk forward one line per Advance and back one line per Previous:

- the **Closest-guess reveal**: the question, then the smallest guess, the highest guess, the answer and the closest teams
- the **Showdown** reveal: each seat's guess in seat order, then the answer and the winner

They have the same shape:

- a short-lived step counter on the session
- a step count
- an Advance/Previous interceptor in the Move plan that takes the press before the state machine does
- a rule for which step a reveal starts on
- a "what is shown at step N" projection

The showdown module says outright that it "mirrors" the closest-guess one. Even so, each has its own counter (`closestGuessRevealStep`, `showdownRevealStep`), its own interceptor, its own Move plan step kind, and its own branch in Commit a move, the presenter preview and the screen projection. Each counter is threaded through about seven modules.

The cost is felt in three ways:

- A change to how stepping works has to be made twice, and the two copies already differ in small ways that nobody chose:
  - A closest-guess walk falls through to the next screen at its ends, while a showdown holds.
  - The closest-guess step is reset by the settle step on any plain transition, so showing the leaderboard or the join overlay mid-walk appears to restart the walk at the question. The showdown step is never touched by settle.
- A third stepped reveal would need a third counter threaded through the same seven modules.
- The step logic (bounds, start step, Previous, fall-through) is tested twice, through two different gateway specs.

## Solution

One **Stepped reveal** module owns the counter and the stepping for whichever stepped reveal is on air. Each reveal supplies only what differs:

- its step count
- what happens at its ends (fall through to the next screen, or hold)
- any guard on the first Advance (the showdown waits for every guess)
- its lines: what is shown up to step N

The session holds one step counter. The Move plan has one reveal step kind. The screens, and what each reveal discloses, stay separate.

For the quiz master and the room, both reveals walk exactly as they do today, with one fix: a reveal's step survives every action that leaves the reveal on air, including showing the leaderboard or the join overlay mid-walk.

## User Stories

1. As a quiz master, I want Advance to add one line to a closest-guess reveal, so that the room sees the smallest guess, the highest guess, the answer and the closest teams one at a time.
2. As a quiz master, I want Advance on the last closest-guess line to move on to the next question, so that I don't need an extra press to leave the reveal.
3. As a quiz master, I want Previous on a closest-guess question's first step to go back to the previous question's last step, so that stepping back mirrors stepping forward.
4. As a quiz master, I want a closest-guess question nobody guessed on to reveal in one step, so that I don't click through empty lines.
5. As a quiz master, I want Advance to reveal each showdown guess in seat order and then the answer and the winner, so that the tiebreak builds suspense.
6. As a quiz master, I want Advance refused until every showdown team has guessed, so that I can't start the reveal with a guess missing.
7. As a quiz master, I want a repeated Advance on the showdown's last step to do nothing, so that a double press doesn't leave the showdown.
8. As a quiz master, I want Previous on the showdown's first step to do nothing, so that I can't step out of the tiebreak by accident.
9. As a quiz master, I want the showdown resolved, with its points and leaderboard refresh, when its final step goes on air, so that the winner gets the points the moment the room sees them.
10. As a quiz master, I want showing and hiding the leaderboard mid-reveal to leave the reveal on the same step, so that a peek at the scores doesn't restart the walk.
11. As a quiz master, I want showing and hiding the join overlay mid-reveal to leave the reveal on the same step, so that letting a late team join doesn't restart the walk.
12. As a quiz master, I want composing the next showdown during the last block's closest-guess reveal to leave that reveal where it is, so that preparing the tiebreak doesn't disturb the screen on air.
13. As a quiz master, I want a new showdown round, including a sudden-death round, to start at its first step, so that its guesses are hidden again.
14. As a quiz master, I want a closest-guess walk to keep its step across a backend restart exactly as it does today, so that a redeploy doesn't change the reveal on air.
15. As a quiz master on `/remote`, I want the presenter preview to describe the next reveal step, so that I know what the next press shows.
16. As a quiz master, I want the Advance slot and the Previous button to show as pressable exactly when a press would step the reveal, so that the controls never offer a press that does nothing.
17. As a team, I want my showdown guess accepted until the reveal starts and refused after, so that nobody can change a guess once the guesses are on screen.
18. As a team on a phone, I want the showdown and closest-guess reveals to show the same step as the big screen, so that my phone follows the room.
19. As a viewer of the big screen, I want each reveal to show only the lines reached so far, so that the answer is never shown early.
20. As a developer, I want one place that owns the step counter, its bounds and its start step, so that a change to stepping is made once.
21. As a developer, I want a reveal to supply only its step count, end behaviour, guard and lines, so that a third stepped reveal comes almost free.
22. As a developer, I want the step logic tested once, so that the two reveals can't drift apart without a test failing.

## Implementation Decisions

- **Stepped reveal module (new, shared types).** It owns:
  - **Which stepped reveal is on air, if any.** The showdown while the quiz is `ended` and a showdown round is active. The closest-guess reveal while a `closest_guess` question with submissions is on `reveal`. These two never overlap, so one counter is enough. Every other reveal is a single step and isn't a stepped reveal.
  - **Stepping.** A movement (Advance or Previous) on the reveal on air gives one of:
    - a new step
    - a hold, at an end of a reveal that holds
    - a fall-through to the state machine, at an end of a reveal that falls through
    - a wait, when the reveal's first-Advance guard refuses
    - none of these, when no stepped reveal is on air

    It also says whether the press reached the final step, which is how Commit a move knows to resolve a showdown.
  - **The start step.** A reveal starts at step 0 when it lands forward, and at its last step when it lands on Previous (closest guess). A new showdown round starts at 0.
  - **Reading a reveal's step.** "The step of reveal X" is the counter when X is on air, and 0 otherwise. Showdown guess acceptance, the showdown view, the closest-guess projection and the screen key all read through this, never through the raw counter. This is what keeps one counter safe while a showdown is composed during a closest-guess reveal.
- **What each reveal supplies.** A small descriptor per reveal kind:
  - its step count (showdown: one per seat plus the final step; closest guess: one plus one per line when someone guessed, else 1)
  - its end behaviour (showdown holds at both ends; closest guess falls through)
  - its first-Advance guard (showdown: every seat has guessed; closest guess: none)

  The disclosure rules stay per reveal and keep taking a step number: the showdown's guesses per seat, then answer and winner; the closest guess's smallest, highest, answer, closest. The deletion test passes about halfway. The counter plumbing concentrates, but disclosure stays where it is.
- **Session state.** `closestGuessRevealStep` and `showdownRevealStep` are replaced by one `revealStep`, ephemeral as both are today. Starting a showdown round no longer writes the counter unless the showdown is the reveal on air. Entering `ended` starts the counter at 0 through the normal start step.
- **Settle.** The counter is recomputed only when the reveal on air changes: a different reveal question lands, the status changes, a showdown round starts, or the quiz ends. Every action that leaves the reveal on air keeps it: leaderboard show/hide/rank, join overlay show/hide, media actions. This replaces today's list of three step kinds that keep the step, and fixes the closest-guess reset when the leaderboard or the join overlay is shown.
- **Move plan.** `showdown_step` and `closest_guess_step` become one `reveal_step` that says which reveal it stepped and whether it reached the final step. `showdown_waiting` stays as the wait. The Advance slot and the pressability rules keep their current answers.
- **Commit a move.** It handles one `reveal_step`, and resolves the showdown when a showdown step reaches the final step. As today, it never runs the state machine for a reveal step and saves nothing.
- **Presenter preview.** It describes a `reveal_step` from the reveal it stepped. The showdown keeps "Reveal step N". The closest guess keeps whatever it shows today.
- **Wire unchanged.** The display and admin views keep `showdownRevealStep`, and the showdown Display screen keeps `step`, now read through the module. The closest-guess reveal is still sent already trimmed, with no step number. Renaming the wire field is out of scope.
- **Docs.** In `GLOSSARY.md`, add **Stepped reveal** (the walk one line per Advance shared by the showdown and the closest-guess reveal, and who owns the counter), and point **Closest-guess reveal**, **Showdown** and the Move plan entry at it. In `DOCUMENTATION.md`, update any mention of the two counters or of the leaderboard resetting a reveal.

## Testing Decisions

- A good test presses Advance and Previous as the quiz master does, and checks what each room is sent and what the session stores. It never reads the counter or asks which step kind was planned.
- **Primary seam: the real-store GameGateway harness.** The existing closest-guess and showdown reveal gateway specs must pass unchanged: 5-step walk, symmetric Previous, single step with no guesses, restart mid-reveal, guesses pending, resolve on the final step, Previous without resolving, no intercept before `ended`. New cases at the same seam:
  - leaderboard show/hide and join overlay show/hide mid closest-guess walk keep the step (red against today's code first, to confirm the reset)
  - the same mid-showdown
  - composing a showdown during a closest-guess reveal leaves the reveal's step and its trimmed lines alone, and the showdown still accepts guesses once the quiz ends
  - a sudden-death round starts at its first step

  Prior art: the closest-guess-reveal, showdown-reveal, showdown-socket and players-reveal-redaction specs, and the real-store test utils (`tieOnFirstQuestion`, `act`, `snapshot`).
- **Pure tests for the Stepped reveal module**, once, over a descriptor: forward and backward bounds, hold vs. fall-through at each end, the first-Advance guard, the start step on forward and backward landing, the final-step flag, and reading a reveal's step when it isn't on air. Prior art: the game-state transition tests in shared types.
- The presenter-context and action-availability specs cover the preview text and pressability, and must pass unchanged.

## Out of Scope

- The reveal screens (`/display`, `/play`) and what each reveal discloses at each step.
- Renaming `showdownRevealStep` on the wire, or sending the closest-guess step.
- Persisting the reveal step. It stays ephemeral, and the closest-guess restart behaviour stays as it is today.
- New stepped reveals.
- Changes to showdown resolution, scoring or sudden death beyond where the step counter starts.

## Further Notes

- **One deliberate behaviour change.** Showing the leaderboard or the join overlay during a closest-guess reveal no longer restarts the walk at the question. This was read from the settle step, not from a test. The first ticket confirms it with a failing gateway test before fixing it.
- The `display-screen-sounds` screen position must not move on reveal steps. That stays true here: the counter isn't part of the progress.
