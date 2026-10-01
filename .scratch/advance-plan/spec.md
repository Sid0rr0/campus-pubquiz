# Spec: One Move plan decides what Advance and Previous do

Status: ready-for-agent

## Problem Statement

The quiz master drives the whole game with two buttons, Advance and Previous, plus the ← / → keys on /control and the same buttons on /remote. What one press does depends on several things: whether the leaderboard is up and how many ranks it has revealed, whether a showdown is mid-reveal after the quiz ended, whether a closest_guess reveal has sub-steps left, and finally the state machine. That decision is written out several times:

- **The server applies it.** The Live session module's action handler runs the showdown step, then the closest_guess step, then the state machine.
- **The server decides whether the buttons are enabled.** The Advance-availability module tries the same steps, but restates the showdown rule by hand instead of reusing it.
- **The server previews the next screen for /remote.** The presenter preview's "next" line has its own copy of the leaderboard reveal rule and the two steps above. Its own doc comment says it "mirrors NavigationButtons".
- **The browser decides what Advance means while the leaderboard is up.** /control's navigation buttons and its keyboard shortcuts each compute "are there unrevealed ranks" from a step count the browser works out itself. They then send REVEAL_NEXT_TEAM, TOGGLE_LEADERBOARD or ADVANCE. /remote does the same through the shared admin controls.
- **The browser decides that Previous is off while the leaderboard is up.** The button is greyed out and the ← key is ignored, but only on the client.

What the quiz master sees:

- **The leaderboard part of "server-decided Advance" never moved to the server.** If the step count the browser computes disagrees with the server's reveal count (for example, a tie that resolves differently after a late grade, or the kahoot top-5 cutoff), the button can say "Show Next Team" when nothing is left to show, or "Hide Leaderboard" one rank early.
- **A raw ADVANCE or PREVIOUS under the leaderboard silently moves the quiz underneath.** The state machine accepts both while the board is up, so the screen behind the board changes without anyone seeing it. The only thing preventing this is that today's buttons happen not to send those actions. A new client, a stale tab, or a keyboard-shortcut bug would expose it live on stage.
- **The /remote "next" line can drift from what Advance actually does.** No test checks that the preview, the button state and the handler agree on the leaderboard and showdown steps.
- **Changing the leaderboard reveal pace means editing about five modules across two workspaces.** That applies to the kahoot pace, the top-5 cutoff, or a new kind of reveal step alike.

The root cause is that no module owns the answer to "what will the next Advance, or Previous, press do?" Each consumer re-derives it.

## Solution

A **Move plan** inside the Live session module decides, for the current session, what one Advance press and one Previous press would do. Everything reads that one decision:

- **The action handler** carries out the planned step.
- **The admin view** tells /control and /remote what the Advance slot does next: reveal the next rank, hide the leaderboard, a normal advance, or nothing. It also says whether Previous is available, covered by the leaderboard, or unavailable.
- **The presenter preview** describes the planned step on /remote's "next" line.

The browser always sends plain ADVANCE or PREVIOUS for these two buttons and their keys. The server resolves the leaderboard case: while the board is up, Advance reveals the next rank, then hides the board once every rank is shown. Previous is rejected while the board covers the screen. A raw ADVANCE or PREVIOUS can never move the quiz underneath the leaderboard again.

Behaviour on stage stays exactly as it is today: same labels, same pace, same kahoot all-at-once reveal between questions, same showdown walk, and same closest_guess sub-steps. The only thing that changes is where the decision lives.

## User Stories

1. As a quiz master, I want the Advance button's label ("Show Next Team", "Hide Leaderboard", "Begin Quiz", "Continue", "Start Round", "Advance") to always describe what the server will do when I press it, so that I never press a button that does something else.
2. As a quiz master, I want "Show Next Team" to switch to "Hide Leaderboard" exactly when the last rank appears on the big screen, so that I never click through an empty step.
3. As a quiz master, I want tied teams to keep appearing together in one reveal step, as today, so that a tie never costs me a click that changes nothing.
4. As a quiz master running a kahoot round, I want the round-end and end-of-quiz leaderboards to keep revealing one rank at a time, capped at the top 5, so that the suspense and pace stay as they are.
5. As a quiz master running a kahoot round, I want the between-questions leaderboard to keep showing its top 5 at once, with Advance hiding it straight away, so that kahoot keeps its race feel.
6. As a quiz master, I want hiding the between-kahoot-questions leaderboard with Advance to open the hidden question and start its timer exactly as hiding it with the Leaderboard toggle does today, so that teams get the same full answering time.
7. As a quiz master, I want Advance to be unavailable while the board is up and every rank is shown, if nothing is waiting underneath, as today, so that the button never offers a move that goes nowhere.
8. As a quiz master, I want the → key to do exactly what the Advance button does, so that the keyboard and the mouse never disagree.
9. As a quiz master using /remote, I want the Advance slot to behave exactly like /control's, including the leaderboard reveal steps, so that presenting from my phone is the same as from the laptop.
10. As a quiz master, I want the Previous button to stay visible but greyed out while the leaderboard is up, as today, so that the button bar doesn't jump around.
11. As a quiz master, I want the ← key to stay ignored while the leaderboard is up, as today, so that I can't step back underneath the board by accident.
12. As a quiz master, I want the server itself to refuse Previous while the leaderboard covers the screen, so that a stale tab or a second admin laptop can never move the quiz underneath the board.
13. As a quiz master, I want the server to treat Advance under the leaderboard as a reveal step or a hide, never as a move of the quiz underneath, so that the screen behind the board only changes when I can see it.
14. As a quiz master, I want the Leaderboard toggle button and the ↑ / ↓ keys to keep showing and hiding the board directly from any status, as today, so that the toggle stays an escape hatch independent of Advance.
15. As a quiz master after the quiz has ended with an active showdown, I want Advance and Previous to keep stepping the showdown reveal exactly as today, so that tiebreakers still walk one step at a time.
16. As a quiz master during a showdown, I want Advance to keep telling me which guesses are still missing instead of silently doing nothing, as today, so that I know why it didn't move.
17. As a quiz master revealing a closest_guess question, I want Advance and Previous to keep walking its reveal sub-steps before moving to the next question, as today, so that the closest-guess drama is unchanged.
18. As a quiz master leaving a break with answers still ungraded, I want Advance to stay pressable and to tell me which questions still need grading, as today, so that I know exactly what's blocking reveal.
19. As a quiz master whose laptop reconnects while the leaderboard is up, I want the resync to restore the same Advance-slot label and Previous state, so that I can carry on immediately.
20. As a quiz master using /remote, I want the "next" line to describe exactly what the next Advance will put on /display: the next leaderboard place ("Next place (n of m)"), hiding the board to the screen underneath, a showdown step, a closest-guess step, or the next screen, so that there are no surprises on stage.
21. As a quiz master using /remote, I want the "next" line to be empty exactly when Advance is unavailable, so that the preview and the button never disagree.
22. As a quiz master, I want a late grade or bonus that changes the standings while the board is up to update the remaining reveal steps on the button straight away, so that the label stays truthful.
23. As an audience member, I want the big screen to keep revealing ranks bottom-up, one press at a time, as today, so that the leaderboard keeps its suspense.
24. As a team, I want my phone's view to be unaffected by this change, so that nothing I see or can do on /play moves.
25. As a developer, I want what one Advance or Previous press does decided in one module, so that changing the reveal pace or adding a new kind of reveal step means editing one place.
26. As a developer, I want one test walk to prove that the admin view's announced step, the presenter preview's "next" line and the handler's actual behaviour agree at every point of a quiz, so that drift between them is caught automatically.
27. As a developer, I want the browser to stop computing leaderboard reveal steps, so that the client holds no game rules for the Advance slot.
28. As a developer, I want the Advance-availability module and the preview's hand-written mirror of the handler deleted, so that there are no copies left to drift.

## Implementation Decisions

- **New concept: the Move plan.** It is a pure decision inside the Live session module. Given the session and a movement (Advance or Previous), it names the one step that press would take:
  - for Advance:
    - reveal the next leaderboard rank
    - hide the leaderboard
    - a showdown reveal step
    - a closest_guess reveal sub-step
    - a state-machine transition
  - for Previous:
    - a showdown reveal step back
    - a closest_guess sub-step back
    - a state-machine transition back
  - or that the press is blocked, with a reason. The reasons are "covered by the leaderboard" (Previous only), "nothing to do", and "showdown waiting for guesses".
- **Fixed precedence order inside the plan:**
  1. the leaderboard, when visible, since it covers the screen
  2. the showdown, once the quiz has ended
  3. the closest_guess reveal sub-steps
  4. the state machine

  This matches what the browser and the preview do today. The handler currently checks the showdown before the leaderboard, but no client ever sends ADVANCE under the board, so the order only becomes reachable through the plan.

- **Leaderboard under Advance:**
  - While the board is up and ranks are unrevealed, Advance reveals the next rank. The step count is the existing shared rule: ties share a step, and a kahoot round caps at the top 5.
  - Once every rank is shown, Advance hides the board, but only if a state-machine Advance from the underlying status would be legal. Otherwise Advance is blocked with "nothing to do". This preserves today's rule, where "Hide Leaderboard" only appears when the underlying status has somewhere to go.
  - Hiding through Advance goes through exactly the same state change as the Leaderboard toggle, so timer arming for the hidden kahoot question is unchanged.
- **Leaderboard under Previous:** blocked with "covered by the leaderboard" whenever the board is visible.
- **The action handler carries out the plan.** It no longer runs its own showdown-then-closest_guess-then-state-machine sequence. Side effects that belong to a transition stay where they are today: the ungraded-answers gate on leaving a break, kahoot speed scoring, block grading, phase timers and persistence. This spec moves only the decision of _which step_.
- **Ungraded gate and showdown waiting stay pressable.** When leaving a break with ungraded answers, the plan still names a transition. Pressing it still fails with the list of ungraded questions, as today. Likewise a showdown waiting for guesses keeps Advance pressable and answers with what's missing. The admin view treats both as available.
- **Admin view contract (shared types):**
  - "Can advance" is replaced by **what the Advance slot does next**: reveal the next rank, hide the leaderboard, advance, or nothing.
  - "Can go to previous" is replaced by **the Previous state**: available, covered by the leaderboard (the button is shown greyed out), or unavailable (the button is hidden).
  - The admin view no longer needs anything from which the client could compute leaderboard steps.
- **Client:**
  - /control's navigation buttons, its keyboard shortcuts and /remote render the Advance slot's label and enabled state from the admin view. They send ADVANCE or PREVIOUS only.
  - The browser-side leaderboard step count in the shared admin controls is removed, along with every "has unrevealed teams" derivation.
  - The Leaderboard toggle button and the ↑ / ↓ keys keep sending the toggle action directly.
  - Labels for the "advance" case ("Begin Quiz", "Continue", "Start Round", "Advance") stay UI copy chosen by status on the client. They are presentation, not a game rule.
- **The REVEAL_NEXT_TEAM action is removed** from the game action set once no client sends it. Advance covers it, and keeping both would leave two ways to do the same step.
- **Presenter preview:** the /remote "next" line is built by describing the planned Advance step. Its hand-written mirror of the leaderboard, showdown and closest_guess rules is deleted. The "now showing" line is unchanged.
- **Deleted modules:** the Advance-availability module and the preview's next-screen mirror. The leaderboard reveal-count rule stays, but only as the implementation of the plan's reveal and hide steps.
- **Reconnect:** the admin view carries the Advance-slot step and the Previous state, so a reconnecting /control or /remote gets them from the normal full-view resync. No new event is needed.

## Testing Decisions

- **A good test here presses buttons and watches outcomes.** It drives the game through the real-store gateway harness and asserts on what the admin view announced, what the presenter preview said, and what the session actually did. It never asserts on the plan's internal step objects or on which helper ran. The Move plan stays an internal detail with no tests of its own, so it can be reshaped freely.
- **One backend seam: the real-store gateway harness.**
  - **Agreement walk.** Extend the existing Advance/Previous availability spec, which already presses each button and checks that the flag matches the handler. At every point of whole-quiz walks, it should assert all three of these:
    - (a) the admin view's announced Advance-slot step is what pressing ADVANCE actually does: a rank revealed, the board hidden, a showdown or closest_guess step, a transition, or no move
    - (b) the Previous state matches what pressing PREVIOUS does
    - (c) the presenter preview's "next" line is empty exactly when Advance moves nothing
  - **Walks to cover:**
    - a two-block quiz through break, reveal and the end-of-block leaderboard
    - a kahoot round, both the between-questions board and the round-end board with the top-5 cutoff
    - a tie on the leaderboard
    - a closest_guess reveal
    - an ended quiz with a showdown
  - **Under-the-board guarantees:** a raw ADVANCE while the board is up never changes the status, round, question or reveal position underneath. It only reveals a rank or hides the board. A raw PREVIOUS while the board is up is rejected and changes nothing.
  - **Kahoot timer parity:** hiding the between-questions board with ADVANCE arms the same question timer that hiding it with the toggle does. Prior art: the kahoot question timer and kahoot leaderboard answer-gate specs.
  - **Late standings change:** a grade or bonus that changes the step count while the board is up updates the announced Advance-slot step in the next admin view.
  - **Prior art:** the Advance/Previous availability spec (the press-and-compare helpers), the presenter-context spec (its "agreement with /display across a whole-quiz walk" test), the showdown-reveal, closest-guess-reveal and leaderboard specs.
- **Frontend:**
  - Component tests with admin-view fixtures check that the Advance slot renders the right label and enabled state for each announced step, and that pressing it, or the → key, sends ADVANCE.
  - When the board covers the screen, Previous renders greyed out, and the ← key sends nothing.
  - Prior art: the existing advance-controls, keyboard-shortcuts and admin-keyboard-shortcuts hook tests, the leaderboard control test, and the /remote page test.
  - Tests that asserted REVEAL_NEXT_TEAM or TOGGLE_LEADERBOARD being sent from the Advance slot are updated to expect ADVANCE.
- **Existing specs survive.** Specs that drive the game through the harness keep passing unchanged, apart from those that sent REVEAL_NEXT_TEAM. Those switch to ADVANCE.

## Out of Scope

- **Moving transition side effects into the plan.** That covers timers, grading, speed scoring, the ungraded gate and persistence. That is the separate "transition returns session plus effects" candidate from the architecture review. This spec only decides _which step_ a press takes.
- **Changing any on-stage behaviour.** That includes reveal pace, kahoot rules, the showdown walk, closest_guess sub-steps and labels.
- **The Leaderboard toggle's own availability.** It stays available from any status, as today.
- **The three bugs found in the same review:** timers not re-armed after a restart, live sockets surviving user deactivation, and the live-edit guard ignoring round settings. They are tracked separately.
- **Other admin actions** (Start, End quiz, Close session, Replay media, Fullscreen). Their availability rules are unchanged.

## Further Notes

- This finishes screen-projection ticket 05 ("Advance/Previous availability decided server-side"). That ticket moved the plain Advance/Previous flags to the server but left the leaderboard steps in the browser.
- The precedence change (leaderboard before showdown) is not a behaviour change in practice. Today's clients always resolve the leaderboard first, and the preview already assumes that order. The handler's showdown-first order is only reachable by a raw ADVANCE under the board, which no client sends.
- "Move plan" is a new domain term. Add it to CONTEXT.md when the first ticket lands. That file doesn't exist yet and is created lazily.
