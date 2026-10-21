# Spec: Control availability comes with the admin view

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 7 ("Speculative", in-process).

## Problem Statement

`/control` and `/remote` decide which of the quiz master's buttons to show by working out game facts on the client. The main one is **which media the big screen is playing right now**. That decides whether "Play again" and Pause/Resume are offered, and whether Space pauses media. The client rebuilds it from the admin view's status, current question, reveal questions and On-air screen. That goes against the rule that the frontend renders the view it is sent, and the server doesn't share the rule at all.

What a quiz master can run into:

- **A closest_guess reveal never offers Pause or "Play again" for its answer media.** The client can't tell how far the closest-guess walk has got, because the step stays on the server, so it leaves those reveals out entirely. Once the walk shows the answer video, the big screen plays it, but the quiz master can't pause or replay it.
- **The rule for "playing" is written twice, in two places that don't know about each other.** The Display screen the server builds for `/display` decides what the big screen shows. The client's copy decides what the controls offer. A change to one (for example to when answer media replaces the question's own) leaves the other offering controls for media that isn't playing, or hiding them for media that is.
- **The server applies `REPLAY_MEDIA` and `TOGGLE_MEDIA_PAUSE` in any status.** A stale `/remote` tab, a second `/control` window or a shortcut pressed between screens can pause or "replay" media that isn't on screen. The paused flag then sits in progress until the next move clears it.

For a developer:

- The client's admin-controls module calls itself presentational, but it holds a game rule (playing media) that needs a pausable-media check from the display code and an answer-media rule copied from the display's question component.
- Its tests have to build partial admin views by hand and cast them, because the inputs are a slice of the payload rather than a real session.

## Solution

The admin view carries **control availability**: what the quiz master can do right now (start, end, close, toggle the join overlay, replay media, pause media), whether answer status is shown, and who is tied for first. The Screen projection builds it next to the admin indicators, from the same session and the same Display screen `/display` is sent. `/control` and `/remote` read it straight from the view.

The media part follows the Display screen exactly. Media is "playing" when the Display screen on air shows a question whose media is playing: the open question's own media, or at reveal the answer media that replaces it, else the question's own. A closest_guess reveal counts once the walk has reached the step that shows it.

The Move plan uses the same rule. It refuses `REPLAY_MEDIA` when nothing replayable is playing and `TOGGLE_MEDIA_PAUSE` when nothing pausable is, as a blocked move, so the session doesn't change.

What changes for users:

- On a closest_guess reveal, "Play again" and Pause/Resume appear once its answer video or audio is on the big screen.
- A media press from a stale tab while nothing is playing is refused rather than quietly setting the paused flag.
- Everything else looks the same: the same buttons appear on the same screens on `/control` and `/remote`.

## User Stories

1. As a quiz master on `/control`, I want "Play again" offered exactly when the big screen is playing a video, so that the button always does something.
2. As a quiz master on `/control`, I want Pause/Resume offered exactly when the big screen is playing a video or audio, so that I never pause nothing.
3. As a quiz master on `/remote`, I want the same media buttons as on `/control` at every moment, so that the two never disagree.
4. As a quiz master, I want Space to pause media only when Pause is offered, as today.
5. As a quiz master at a closest_guess reveal, I want Pause and "Play again" offered once the answer video is on the big screen, so that I can control it like any other reveal.
6. As a quiz master at a closest_guess reveal, I want them not offered before the walk reaches the answer media, so that I can't replay something the room hasn't seen.
7. As a quiz master at a reveal whose answer media replaces the question's own, I want the controls to follow the answer media, as today.
8. As a quiz master at a reveal with no answer media, I want the controls to follow the question's own media, as today.
9. As a quiz master at a reveal whose media is an image, I want no Pause or "Play again", as today.
10. As a quiz master with an open question whose media is a YouTube clip, an uploaded video or audio, I want the media controls, as today.
11. As a quiz master while a question is locking, during break review, under the leaderboard or join overlay, or on a title card, I want the media controls only where the big screen is actually playing media, matching what `/display` shows.
12. As a quiz master, I want Start offered only in the lobby, End until the quiz has ended and Close only once it has, as today.
13. As a quiz master, I want the join-overlay toggle offered only where the overlay is allowed, as today.
14. As a quiz master, I want answer status shown only while a question is on air, as today.
15. As a quiz master at a tie for first, I want the tied teams' names offered for a showdown, as today.
16. As a quiz master with a stale `/remote` tab, I want a Pause or "Play again" press while nothing is playing to be refused, so that it can't leave the media paused for the next question.
17. As a quiz master, I want a refused media press to leave the big screen and every view unchanged.
18. As a quiz master who reconnects `/control` mid-question, I want the controls right straight away from the resynced view, with no client-side catching up.
19. As a big-screen operator, I want pause and replay to keep working exactly as today whenever media is playing.
20. As a developer, I want the playing-media rule defined once, beside the Display screen, so that the controls and `/display` can't drift.
21. As a developer, I want the Move plan to refuse unavailable media actions using that same rule, so that the server and the buttons agree.
22. As a developer, I want `/control` and `/remote` to render the control availability they are sent, so that page tests use the fixture builder rather than casting partial views.
23. As a developer, I want control availability tested through the Screen projection for the admin room, so that the test builds a real session and reads the view.
24. As a developer, I want the pausable-media check moved from the display code into shared types, so that the server can use it.

## Implementation Decisions

- **Control availability is part of the admin view.** The admin room's view gains a control-availability field: can start, can end, can close the session, can toggle the join overlay, can replay media, can pause media, whether answer status is shown, and the tied-for-first team names. These are the same fields the client's admin controls have today. The Screen projection builds it for the admin room beside the admin indicators. No other room gets it.
- **Playing media is read from the Display screen.** One shared function answers "the media the big screen is playing" from the Display screen built for the session: the open question's own media, or on a reveal screen the answer media (which replaces the question's own), else the question's own. Because the Display screen's reveal question is already cut down to the closest-guess step, a closest_guess reveal counts once its answer media is shown, and not before. Screens that show no question play nothing. Replayable means a video URL. Pausable means video or audio, using the shared media classifier.
- **The admin projection builds the Display screen too.** It builds the same Display screen the display room is sent and reads playing media from it, so the two can't disagree. It doesn't send that Display screen to the admin room.
- **The Move plan refuses unavailable media.** Planning `REPLAY_MEDIA` when nothing replayable is playing, or `TOGGLE_MEDIA_PAUSE` when nothing pausable is, returns a blocked move with an illegal-transition cause, the same refusal any other illegal action gets. Commit a move refuses it as usual. The session doesn't change and nothing is broadcast. `TOGGLE_MEDIA_FULLSCREEN` is unchanged.
- **Clients render what they're sent.** `/control` and `/remote` read control availability from the admin view. The client's admin-controls module and its playing-media copy are deleted. Space for pause keeps its current gate, now read from the view. Clients still never send a media press the view says is unavailable, so a refusal only comes from a stale view.
- **Media helpers move to shared types.** The pausable-media check moves beside the shared media classifier. The display code imports it from there.
- **Protocol change:** the admin view gains one field, and the two media actions can now be refused. The `DOCUMENTATION.md` actions table changes for `REPLAY_MEDIA` and `TOGGLE_MEDIA_PAUSE` from "any" to "while media is playing", in the same commit. The `/guide` page needs one line on closest_guess reveals, since Pause and "Play again" now appear there.

## Testing Decisions

- **A good test here sets up a session in a given state and checks what the admin view offers** (or whether a media press is refused). It doesn't test which helper worked it out.
- **Seam: the Screen projection for the admin room**, in a backend spec like the existing admin-flags projection spec (build a session, call the projection for the admin room, read control availability). Cases:
  - status-based fields: lobby, a running status, ended, and the join-overlay-allowed statuses;
  - an open question with YouTube, uploaded video, audio, image and no media;
  - a reveal with answer media (it replaces the question's own), without answer media (the question's own), and with image media;
  - a closest_guess reveal before and after the walk reaches its answer media;
  - locking, break review, a title card, and under the leaderboard and the join overlay;
  - answer status shown only while a question is on air; tied-for-first names at a tie.
- **Refusal:** in the existing admin-actions spec (real game state), a replay and a pause press while nothing is playing are refused and leave progress unchanged. The existing cases (replay bumps the token, pause toggles and resumes on replay) keep passing.
- **Frontend:** `/control` and `/remote` page tests set control availability through the shared admin-view fixture builder. The client admin-controls unit tests are deleted, since their cases move to the projection spec.
- **Prior art:** the admin-flags projection spec and the screen-projection spec for pure projection tests over a built session; the admin-actions spec for media actions through the game state.

## Out of Scope

- Moving other client-side "can I" checks (the Advance and Previous slots, grading buttons) into control availability. They already come from the Move plan or the view.
- Refusing the join-overlay toggle, start, end or close based on control availability. Those transitions are already guarded by the game state.
- Changing fullscreen media behaviour.
- Changing what `/display` shows or how it plays, pauses or replays media.
- Showing control availability anywhere other than `/control` and `/remote`.

## Further Notes

- The review rated this "Speculative": the client module already keeps `/control` and `/remote` in step, and the gain is mostly enforcement. Two things here go beyond the review: the closest_guess fix (a visible gain) and the server-side refusal (the enforcement).
- The playing-media function belongs beside the Display screen, so a future change to how `/display` picks media (for example, side-by-side image reveals) changes the controls with it.
