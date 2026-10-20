# Spec: Big-screen sounds follow the Display screen

Status: ready-for-agent

Blocked by: none. `control-shortcuts-and-mute` (the big-screen mute over media), which touched the same sounds, is done.

Source: architecture review 2026-10-20, "Out of Scope, revisited", candidate 3. `display-screen-kind` and `display-screen-content` both deferred this item.

## Problem Statement

`/display` draws the **Display screen** the server sends and looks nothing up. Its sounds don't work that way. The page still works out four of the big screen's one-off sounds from the session's status, using three different sources:

- **fanfare** (with confetti): the Display screen's kind becomes `ended`.
- **reveal sting**: `progress.status === 'reveal'`, with forward moves detected by a client-side `revealPosition` that orders blocks, phases and reveal steps.
- **time-up**: `isGradedStatus(progress.status)` flips on.
- **round sting**: a second client-side ordering of the quiz (status → phase table in `use-round-title-sting`), plus a check on the Display screen's kind.

This breaks the rule that the frontend does no game logic. The client keeps two copies of the quiz's order, and when the move plan changes it, they can drift without anyone noticing. Some sounds follow what is on screen and others follow the status underneath. For example, the reveal sting and the time-up play under the join overlay, but the round sting doesn't. And the only way to test which sound plays when is to render the whole page.

## Solution

Sounds become a function of the Display screen transition the big screen sees:

- The server sends the display one more number, the **screen position**. It grows on every forward move through the quiz and falls on Previous. Only the server orders the quiz.
- `/display` keeps the previous Display screen. When the screen position grows on a connected display, the page asks one pure sound table which sound the move from the previous screen to the new one plays, if any. Then it plays that sound through the display sound registry.
- The live-change rule doesn't change. No sound plays for the first snapshot after a load or reconnect, and none plays on Previous.

For the quiz master and the room, nothing changes except two edge cases. These are listed under Further Notes.

## User Stories

1. As a quiz master, I want the round sting to play when I advance onto a round's title card, so that the room knows a new round is starting.
2. As a quiz master, I want no round sting on the break round title card or on the reveal intro card, so that cards shown back to back don't repeat the sting.
3. As a quiz master, I want the reveal sting to play each time I advance onto a revealed answer, so that every answer gets its moment.
4. As a quiz master, I want stepping through a closest-guess reveal not to replay the reveal sting, so that the sting marks the answer, not every step of it.
5. As a quiz master, I want the time-up sound to play once when the block locks, so that the room hears the countdown end.
6. As a quiz master, I want the time-up sound not to play again as I move through the break, so that it only marks the lock.
7. As a quiz master, I want the fanfare and confetti when I end the quiz, so that the night closes with a celebration.
8. As a quiz master, I want no second fanfare at the end if the final leaderboard has already crowned the winner with one, so that the celebration doesn't play twice.
9. As a quiz master, I want Previous never to play a sound, so that stepping back to fix a mistake doesn't sound like progress.
10. As a quiz master, I want a reloaded or reconnected big screen to stay silent until the next live move, so that a dropped Wi-Fi connection doesn't replay the last sound.
11. As a quiz master, I want showing or hiding the leaderboard or the join overlay to play none of these sounds, so that toggling an overlay doesn't sound like the quiz moved.
12. As a quiz master, I want the sounds to follow what the room can see, so that nothing plays for a screen hidden under an overlay.
13. As a quiz master, I want the big-screen mute and the "Enable sound" unlock to keep working for these sounds, so that muting for a speech still silences them.
14. As a quiz master, I want the sounds to stay right when the quiz's order changes (new statuses, a changed move plan), so that a change on the server can't leave the big screen playing the wrong sound.
15. As a developer, I want one table that says which Display screen transition plays which sound, so that I can read or change the big screen's sounds in one place.
16. As a developer, I want to test the sound table without rendering a page, so that the tests are small and fast.
17. As a developer, I want the client to hold no copy of the quiz's order, so that the move plan is the only place that defines it.

## Implementation Decisions

- **Screen position (new, server-sent).** A pure function in shared types, next to the On-air screen, turns a session's progress into one number. The screen projection puts that number on the display view as `screenPosition`. Only `/display` reads it, so it goes in the display view and not in the shared snapshot (socket protocol rule). It must hold these invariants:
  - It strictly grows on every `ADVANCE`, `START_QUIZ` or `END_QUIZ` that changes the On-air screen underneath any overlay. This covers lobby/rules/round overview → round intro → question(s) → locking → break intro → break review → break round intro → reveal intro → each reveal → the next block → ended.
  - It strictly falls on every `PREVIOUS` that changes that screen.
  - It doesn't change for overlays (leaderboard, join overlay), leaderboard rank reveals, showdown steps, closest-guess reveal steps, media fullscreen/pause/replay, or answer and roster updates.
  - It replaces `revealPosition` (frontend) and `getQuizPosition` (`use-round-title-sting`). Both are deleted.
- **Display sounds module (frontend).** It exposes one pure function, `soundFor(previous, next) → DisplaySoundName | null`, over two Display screens. It only ever runs for a live forward move. The table:
  - `next.kind === 'round_title'` → `sting`
  - `next.kind === 'reveal'` → `reveal`. A forward move between two reveals shows the next question, because closest-guess steps don't move the screen position.
  - `previous.kind` is `question` or `locking`, and `next.kind` is a screen after the lock (`break_intro`, `break_review`, `break_round_title`, `reveal_intro` or `reveal`) → `timeUp`. A move from a question to a question or to locking plays nothing.
  - `next.kind === 'ended'` → `fanfare`
  - anything else → `null`
- **One hook on `/display`.** A display screen sounds hook takes the display view's `screen` and `screenPosition`, `isConnected`, and whether a winner has already been crowned live. It feeds `screenPosition` to the existing live-change gate. On a forward move it calls `soundFor` with the screen it last saw and the current one, and plays the result through `displaySounds`. On `fanfare` it also fires confetti, and it skips both if a winner has already been crowned. It replaces the three `useOnLiveForwardMove` calls in the page and `useRoundTitleSting`, which is deleted.
- **Winner suppression stays page state.** The final leaderboard's `onWinnerCelebrated` callback still sets a flag that the hook reads. A pure transition can't know what happened screens earlier.
- **No change** to the display sound registry, the big-screen mute, the unlock gesture, or the live-change helper.
- **Docs.** In `GLOSSARY.md`, add **Screen position**: the number that orders On-air screens for live-change effects, and how it differs from the screen key (which only says the screen changed). In `DOCUMENTATION.md`, add the `screenPosition` row to the display view table. CODING_STANDARDS' live-change rule still holds as written.

## Testing Decisions

- A good test checks what the room hears for a sequence of views the big screen receives. It doesn't check which hook fired, or the position number's value.
- **Primary seam: the `/display` page** with `useDisplayGame` and `displaySounds` mocked, and views built by the `roomView` fixture. The fixture runs the real projection, so `screenPosition` comes from the server code under test. Prior art: `display/__tests__/time-up-sound.test.tsx`, `reveal-moment.test.tsx`, `ended-moment.test.tsx`, `showdown-sounds.test.tsx`. These existing tests must keep passing unchanged, apart from fixture tweaks. Add cases for the round sting and its exclusions (moved from `use-round-title-sting.test.ts`, which is deleted along with the hook), closest-guess steps, Previous, reconnect, overlay toggles, and no sounds under an overlay.
- **Pure tests for `soundFor`**: one case per row of the table, plus `null` for the transitions that play nothing. Prior art: `lib/__tests__/display-sounds.test.ts`, `live-change.test.ts`.
- **Shared-types test for the screen position invariant.** Walk a seeded quiz with the forward-transition and backward-transition fixtures. Assert that the position strictly grows on every Advance that changes the On-air screen, strictly falls on every Previous, and stays put on the overlay, step and media actions. Prior art: `game-state-forward-transitions.test.ts`, `game-state-backward-transitions.test.ts`, `game-state-fixtures.ts`. `reveal-position.test.ts` is deleted with `revealPosition`, and any order cases it covers that this walk doesn't move here.

## Out of Scope

- **Sounds for steps inside one screen.** These stay with the component that animates them, on their own live-change positions:
  - the leaderboard's drumroll and winner fanfare, keyed on rank reveals
  - the showdown's slam and burst, keyed on showdown steps
- The lobby chime (team roster changes) and the lock countdown sound (a timer). Neither is a screen transition.
- Phone vibrations and stamps on `/play`. They have their own live-change positions.
- New sounds, volume, or changes to which events play a sound.

## Further Notes

- **Two deliberate behaviour changes**, both from "sounds follow the Display screen":
  - Under the join overlay, the reveal sting and the time-up no longer play, because the room can't see the screen they mark. The lock countdown sound, which is out of scope, still plays.
  - After an end-of-quiz showdown, returning to the ended screen doesn't replay the fanfare. Today the kind-based trigger fires again on showdown → ended. The screen position doesn't move for a showdown, so the move into `ended` is the only one.
- Once this lands, the in-screen sounds (leaderboard, showdown) could fold into the same table if they ever get a screen-step field of their own. That isn't needed now.
