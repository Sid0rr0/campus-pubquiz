# Spec: Join overlay and Previous back to the lobby

Status: done

## Problem Statement

The join code and QR code only appear on the big screen while the session is in the lobby. Once the quiz master presses Start quiz, there is no way to get them back:

- **Late teams can't get in.** A team that arrives during round 2 is allowed to join (the backend accepts a join at any status), but nobody in the room can see the code. The quiz master ends up reading it out or showing the laptop.
- **Start quiz can't be undone.** If the quiz master presses Start quiz too early, the session is stuck on the rules. Previous does nothing there, and everything that only works in the lobby is locked: session settings, quiz import and closing the session.

## Solution

Two independent additions, both driven from `/control`:

1. **Previous on the rules goes back to the lobby.** It's the existing backward walk taken one step further. The big screen shows the lobby (QR code, join code, roster) again, phones go back to "Waiting for the quiz to start…", and everything that only works in the lobby unlocks. Start quiz moves forward again as before. This is only allowed from the rules: `round_overview` goes back to the rules first, and from the first round intro onward the block has started and the quiz can't go back to the lobby.
2. **A join overlay.** A new admin action, Toggle join overlay, shows the join code and QR code over the big screen at any point after the quiz has started. Like the leaderboard, it isn't a status: the quiz carries on underneath, timers included, and phones are untouched. Turning it off resumes exactly where the big screen was. The overlay and the leaderboard are never up together.

The domain term is **Join overlay** (see `GLOSSARY.md`). Don't call it "QR screen" or "lobby overlay": the lobby is a status, and this overlay isn't one.

## User Stories

1. As a quiz master, I want to put the join code and QR code back on the big screen mid-quiz, so that a team arriving late can scan it and join.
2. As a quiz master, I want the quiz to stay exactly where it was while the join overlay is up, so that showing the code never costs me a question or a reveal step.
3. As a quiz master, I want to hide the join overlay with the same button I used to show it, so that showing and hiding feel symmetrical.
4. As a quiz master, I want Advance or Previous to hide the join overlay first, without moving the quiz, so that I can't skip a question by accident while the overlay covers it.
5. As a quiz master, I want the next press after that to move the quiz as normal, so that hiding the overlay never takes extra effort.
6. As a quiz master, I want showing the join overlay to hide the leaderboard, and showing the leaderboard to hide the join overlay, so that only one thing is ever covering the big screen.
7. As a quiz master, I want the Toggle join overlay button to show whether the overlay is up, so that I know what the room is seeing without looking at the TV.
8. As a quiz master, I want a keyboard shortcut for the join overlay next to the leaderboard's, so that I can show it without reaching for the mouse.
9. As a quiz master, I don't want the Toggle join overlay button in the lobby, because the lobby already shows the QR code.
10. As a quiz master, I don't want the Toggle join overlay button once the quiz has ended, because there's nothing left to join.
11. As a quiz master, I want the join overlay to go away on its own when the quiz ends or goes back to the lobby, so that it's never left stuck on.
12. As a quiz master, I want the join overlay to still be up after a backend redeploy or restart, so that a restart doesn't change what the room is looking at.
13. As a moderator, I want the same Toggle join overlay control as an admin, so that whoever is running the session can let a late team in.
14. As a team that's already playing, I want my phone to stay on whatever it was showing while the join overlay is up, so that I can keep answering.
15. As a team that's already playing, I want answer timers to keep running while the join overlay is up, so that the overlay doesn't secretly give everyone extra time.
16. As a late team, I want to scan the QR code from the overlay and land on `/play` with the join code already filled in, the same as in the lobby, so that joining mid-quiz is no harder than joining before it.
17. As a late team, I want the overlay to show the team-size limit and the extra-player penalty, so that we know the rules before we join.
18. As a viewer in the room, I want the join overlay to show only the QR code, join code and team-size line, without the team roster, so that the screen stays readable mid-quiz.
19. As a quiz master who pressed Start quiz too early, I want Previous on the rules to take the session back to the lobby, so that I can wait for more teams.
20. As a quiz master back in the lobby, I want session settings to be editable again, so that I can fix a setting I noticed only after starting.
21. As a quiz master back in the lobby, I want quiz import, quiz overwrite and closing the session to be allowed again, the same as before the quiz started.
22. As a quiz master back in the lobby, I want Start quiz to be the next press again, so that going forward again works exactly as it did the first time.
23. As a quiz master, I want Previous on the rules to happen without a confirm dialog, because no answers exist yet and Start quiz undoes it in one press.
24. As a quiz master, I want the Previous button and keyboard shortcut to work on the rules, so that the backward walk behaves the same everywhere.
25. As a quiz master, I want Previous from `round_overview` to still go to the rules, not straight to the lobby, so that the backward walk stays one step at a time.
26. As a quiz master, I want Previous from the first round intro onward never to reach the lobby, so that I can't throw away a block teams have started answering.
27. As a team, I want my phone to go back to "Waiting for the quiz to start…" when the session returns to the lobby, so that it matches the big screen.
28. As a presenter on `/remote`, I want the "next" line to describe what the next press will do while the join overlay is up (hide it), so that it doesn't promise a quiz move that won't happen.

## Implementation Decisions

- **Previous from the rules.** The shared transition function accepts `PREVIOUS` on `rules` and returns `lobby`, resetting round, question and reveal indexes to the lobby's starting point. Previous from the lobby is still illegal. The Move plan treats this as an ordinary underlying move, so it goes through Commit a move and the Settle step like any other Previous. The live-edit frontier is unaffected, because no question has opened at the rules.
- **The join overlay flag.** Session progress gains a boolean `isJoinOverlayVisible`, next to `isLeaderboardVisible`, defaulting to false. It's saved on the game session row like the leaderboard flag, which needs a MikroORM migration adding a non-null boolean column defaulting to false. The game progress repository reads and writes it, and a restart restores it.
- **The new admin action.** `TOGGLE_JOIN_OVERLAY` is added to the admin actions and to the socket payload validation. It's a plain transition, not an Advance/Previous movement:
  - It's legal from every status except `lobby` and `ended`. Elsewhere it's illegal and surfaces as the usual illegal-transition socket exception.
  - It flips `isJoinOverlayVisible`. Turning the overlay on also turns the leaderboard off, and the Settle step resets the leaderboard reveal counter the same way a leaderboard hide does.
  - `TOGGLE_LEADERBOARD` turning the leaderboard on now also turns the join overlay off.
  - The admin roles allowed are the same as for `TOGGLE_LEADERBOARD`.
- **Clearing the flag.** Any transition that lands on `lobby` or `ended` sets `isJoinOverlayVisible` to false. That covers Previous from the rules, End quiz, and the normal advance into `ended`.
- **The Move plan.** When the join overlay is up, an Advance or Previous press plans a new step kind that hides the join overlay and does nothing else. Its effective action is `TOGGLE_JOIN_OVERLAY`, just as the leaderboard hide step's effective action is `TOGGLE_LEADERBOARD`. Unlike the leaderboard hide, it's always pressable: it doesn't depend on whether the status underneath can move, and Previous is not refused. The next-press helper is unchanged, since the overlay can't be up in the lobby.
- **The presenter preview.** The preview is a dry-run commit of the planned step, so `/remote`'s "next" line describes hiding the overlay. The screen-preview text gains a short heading for the join overlay screen.
- **The on-air screen projection.** The shared screen projection gains a `join_overlay` screen kind. It's checked right after the leaderboard and before the status switch, and it has its own stable screen key. It covers whatever the status would show, including a showdown on `ended`. That can't happen in practice, because the flag is clear on `ended`.
- **The phone screen projection is not changed.** The players view and the phone screen ignore `isJoinOverlayVisible`, and so does the kahoot visibility rule (which only looks at the leaderboard).
- **The admin view** exposes `isJoinOverlayVisible` so `/control` can show the button's pressed state.
- **`/display`.** Draws the `join_overlay` screen kind with the QR code, join code and team-size/penalty line pulled out of the lobby screen into a shared component that both screens use. The overlay doesn't show the team roster. The QR code still points at `/play?code=<joinCode>`.
- **`/control`.**
  - A Toggle join overlay button sits next to Toggle leaderboard in the admin actions, the desktop sidebar and the mobile admin bar. It's hidden or disabled in `lobby` and `ended`, and shows a pressed state while the overlay is up.
  - A new keyboard shortcut sits next to the leaderboard's, following the same rules (ignored while typing in a field).
  - The Previous button and its shortcut become enabled on `rules`.
  - `/remote` gets no new controls.
- **Docs, in the same change.** `DOCUMENTATION.md`:
  - the admin actions table gets the new row, and the `PREVIOUS` row is extended to cover rules → lobby;
  - the note that the leaderboard isn't a status is extended to cover the join overlay;
  - the lobby row is extended with "also reached by `PREVIOUS` from `rules`".

  The `/guide` page explains when to use the join overlay and that Previous on the rules goes back to the lobby. `GLOSSARY.md` already has the **Join overlay** entry and the updated **Move plan** entry.

## Testing Decisions

- **What makes a good test.** It checks behaviour through the public entry point (a socket admin action and the views and screens the clients receive), not internal helpers or the order of calls. Every test should still pass if the overlay's projection or planning code were reorganised.
- **Primary seam: backend gateway tests against a real database.** This is the existing real-store harness, as used in `advance-under-leaderboard.spec.ts`, `admin-actions.spec.ts`, `action-availability.spec.ts` and `persistence-and-quiz-selection.spec.ts`. They cover:
  - Previous on the rules returns to the lobby. The display and players views show the lobby screens, lobby-only settings changes are accepted again, and Start quiz works again.
  - Previous on the lobby is refused. Previous from `round_overview` lands on the rules. Previous from the first round intro never reaches the lobby.
  - Toggle join overlay is refused in `lobby` and `ended` and accepted elsewhere. The display's on-air screen becomes the join overlay while the players' phone screen is unchanged.
  - Showing the join overlay hides the leaderboard and resets the reveal counter. Showing the leaderboard hides the join overlay.
  - With the overlay up, Advance hides it without moving the status, and Previous hides it rather than being refused. The next press moves the quiz.
  - End quiz and Previous to the lobby clear the flag.
  - A question's lock deadline is unchanged by showing and hiding the overlay (use the frozen-clock helpers).
  - The flag survives a save and a restart restore.
  - The presenter preview while the overlay is up describes hiding it.
- **Shared state-machine unit tests**, only for the transition rules themselves, in the existing `game-state-backward-transitions` and `game-state-leaderboard-and-guards` tests. Cover `PREVIOUS` rules → lobby, the legality and mutual exclusion of `TOGGLE_JOIN_OVERLAY`, and clearing on `ended`.
- **Frontend Vitest tests.**
  - `/display` draws the join overlay screen kind (QR code with the join code in its value, join code text, team-size line, no roster), in the style of `screen-kind.test.tsx` and `completion-and-leaderboard.test.tsx`.
  - `/control`: the Toggle join overlay button sends the action and reflects the pressed state, and isn't offered in the lobby or ended, in the style of `leaderboard.test.tsx`. The keyboard shortcut is covered in `keyboard-shortcuts.test.tsx` and `use-admin-keyboard-shortcuts.test.ts`. The Previous button is enabled on the rules, in `previous-button.test.tsx`.

## Out of Scope

- Going back to the lobby from anywhere past the rules, or a "reset to lobby" action that throws away progress.
- A confirm dialog for Previous on the rules.
- Join overlay controls on `/remote`.
- Pausing timers, or refusing the toggle, while a question is open or locking.
- Showing anything on phones while the join overlay is up.
- A small QR code permanently in a corner of the big screen.
- Any change to who may join or when. Joining at any status already works.

## Further Notes

- The join overlay copies the leaderboard's "not a status" design on purpose. Keeping it a progress flag rather than a status means the backward walk and status groups don't change.
- After Previous back to the lobby, `ADVANCE` stays illegal in the lobby: going forward again is Start quiz, which is already the lobby's next press.
