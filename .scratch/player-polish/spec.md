# Spec: Player polish — motion, sound and haptics for the big moments

Status: done

Blocked by: None. Ticket 01 lays the shared rules every other ticket uses; tickets 03–09 are delivered in order (reveal first, ended last) but each is shippable on its own once 01 is in.

## Problem Statement

The game works, but the room's big moments land flat. The big screen already crossfades between screens, counts the leaderboard up, and animates the lock countdown with a sound; beyond that, a correct answer appears with no more weight than a wrong one, a round starts with no sting, the showdown — the most dramatic moment of the format — looks like any other screen, and the quiz ends on a plain "Quiz complete!".

The phones are flatter still. Screen changes cut. A team learns its answer was right only by opening the answered-questions list. Nothing tells a team the block is about to lock, that it locked, or that its answer was saved. Nothing tells the team whose turn it is in a showdown, beyond the form appearing. And at the end, a team doesn't see where it finished before being asked for feedback.

## Solution

Polish a handful of **moments** hard instead of animating everything softly. In delivery order:

1. **Reveal** — the answer lands with an entrance per answer kind, the big screen counts up how many teams got it, and each phone shows its own team's **verdict** for that question at the same instant.
2. **Leaderboard** — the top three reveal slower with a drumroll, rank 1 gets a spotlight, and each phone highlights its own row.
3. **Lock** — phones show a draining bar while the block is locking, a "Locked" stamp when it locks, and a "Saved ✓" on every submit.
4. **Round title card** — a short entrance on both screens, with a sting sound on the round intro.
5. **Lobby** — teams pop into the roster with a rate-limited chime; the phone confirms the join.
6. **Showdown** — a spotlight on the team in turn, guesses slam in, the winner gets a burst; the phone in turn vibrates "Your turn!".
7. **Ended** — confetti, fanfare and a podium on the big screen; each phone shows its final placing before the feedback form.

Sound plays on the big screen only. Phones vibrate (where the browser supports it) and never play sound. The moderator can mute the big screen from `/control`.

All of it is decoration on server state. The server still decides every screen; animation never adds, removes or delays a step.

## User Stories

1. As a player watching the big screen, I want the correct answer to land with an entrance that fits the question (the right option lighting up, a sort sliding into order), so that the reveal feels like a moment.
2. As a player, I want the big screen to count up "7 of 12 teams" got it right, so that the room reacts to hard and easy questions.
3. As a player, I want my phone to show "✓ Correct +2", "Close! +3", "✗" or "No answer" as the big screen reveals a question, so that my team knows how we did without searching for it.
4. As a player with auto-advance off, I want that verdict card anyway, because it follows the big screen, not my browsing.
5. As a player, I want a short vibration when we got it right.
6. As a player, I want the top three on the leaderboard to come in slower with a drumroll and the leader spotlit.
7. As a player, I want my phone to highlight my team's row and say "You're 4th", and to buzz when we move up.
8. As a player, I want a draining bar on my phone while the block is locking, a buzz and a "Locked" stamp when it locks, and a "Saved ✓" every time I submit.
9. As a player, I want each round to open with a short title entrance on both screens, and a sting on the big screen.
10. As a player joining in the lobby, I want my team to pop into the roster with a chime, and my phone to tell me to look for my team name on the big screen.
11. As a player in a showdown, I want my phone to buzz "Your turn!" when it's my seat, and the big screen to spotlight the team in turn and slam each guess in.
12. As a player at the end, I want confetti, a fanfare and a podium on the big screen, and my phone to show "You finished 4th of 12" (or "Joint 2nd") before asking for feedback.
13. As a player with reduced motion turned on, I want every one of these to become a plain crossfade, with nothing moving across the screen.
14. As a moderator, I want Advance to move the quiz immediately even while an animation plays, so that the polish never slows the night down.
15. As a moderator, I want Previous to go back quietly, with no sounds, buzzes or confetti.
16. As a moderator, I want a mute toggle for the big screen on `/control`, so that I can silence it during a speech without walking to the display PC.
17. As a moderator, I want a redeploy or a reloaded big screen not to fire confetti, sounds or twenty buzzing phones again.

## Implementation Decisions

### Shared rules (ticket 01)

- **Live change only.** A one-off effect (sound, vibration, confetti, verdict card, stamp) fires only when a connected client sees the game move *forward* into the moment. It never fires on the first snapshot after a load or reconnect, and never when the move was Previous. One frontend helper owns this decision; every effect asks it, so no ticket invents its own rule.
- **Previous** lands on the end state with the plain crossfade.
- **Reduced motion is a hard rule.** Under `prefers-reduced-motion: reduce`, every entrance becomes a crossfade and confetti is off. Only `transform` and `opacity` are animated (no blur, no animated shadows), because the big screen may be a modest laptop on a projector and phones are mid-range. Both rules go into `CODING_STANDARDS.md`.
- **Animation never gates a press.** A new screen key cuts the running animation to its end; nothing queues behind an animation.
- **Display sound registry.** One module names every display sound and plays it through the existing sound unlock (`EnableSoundButton`, `use-lock-countdown-sound.ts`), and honours the session's mute setting. Sounds are CC0 files under `apps/frontend/public/sounds/` with a licence note next to them.
- **Phone vibration helper.** One helper wraps `navigator.vibrate`, does nothing where it is unsupported (iOS Safari), and is the only caller of it. Vibration is an extra; nothing depends on it.
- **Confetti** uses `canvas-confetti` with `disableForReducedMotion`.
- `motion` (already a dependency) does every other animation.

### Mute (ticket 02)

- A new session setting, display sound muted, set from `/control` next to the display text scale, carried to the display view like the text scale. Saved like the other session settings.

### Reveal (ticket 03)

- **Answer entrance per answer kind**: options — the correct one lights up, the rest dim; typed and number — the answer text pops in; sort — items slide into the correct order; match — pairs settle into place; closest_guess — each existing reveal step line slides in as it arrives. The closest-guess step sequence is unchanged: no new Advance presses.
- **Teams-correct count**: the display view's reveal carries, for the question being revealed, the number of teams whose answer's verdict is `correct`, the number with `partial`, and the number of teams in the session. Shown as a count-up "7 of 12 teams", with "+2 close" when partials exist. Teams that didn't answer count in the total. No count on closest_guess, whose reveal already names the closest teams. Worked out by the backend; the display only draws it.
- **Phone verdict card**: when the big screen lands on a revealed question, every phone shows a card over its screen that dismisses itself after about 3 seconds and never blocks input: "✓ Correct +2", "Close! +3" (partial verdict, with the actual points), "✗ +0", or a neutral "No answer". Shown whatever the auto-advance setting. Vibrates on `correct` only. Built from the team's own answer data the phone already has.

### Leaderboard (ticket 04)

- On the big screen, ranks 3, 2 and 1 reveal slower than the others with a drumroll; rank 1 gets a spotlight. Rank reveal stays one rank per Advance as today.
- On the phone's leaderboard screen, the team's own row is highlighted with its placing ("You're 4th", "Joint 2nd" from the competition rank).
- The phone vibrates when its team moved up, only when the leaderboard shows trends — never on the first board.

### Lock (ticket 05)

- During `locking`, the phone shows a thin bar draining to the lock deadline the display already counts to.
- When the block locks, the phone vibrates and shows a "Locked" stamp.
- Every accepted submit shows a small "Saved ✓" confirmation (this one is a response to the team's own action, so it is not subject to the live-change rule).

### Round title card (ticket 06)

- A short entrance (≤ 1.2 s: round number, then the name sliding in) on the big screen's round title card and the phone's `round_title` screen.
- The sting sound plays on the round intro only, not on the break round intro or the reveal intro, which repeat back to back.

### Lobby (ticket 07)

- New teams pop into the roster with a soft chime, at most one chime per 500 ms however many teams join.
- After joining, the phone shows "You're in! Look for <team name> on the big screen".

### Showdown (ticket 08)

- The big screen spotlights the team whose seat is up; each guess slams in with a sound when revealed; the winner gets a burst.
- The phone of the team in turn vibrates and shows "Your turn!"; other phones show "Tiebreaker in progress" with a subtle pulse.

### Ended (ticket 09)

- The big screen gets confetti, a fanfare and a podium of the top three.
- Each phone shows "You finished 4th of 12" (ties as "Joint 2nd", from the competition rank) before the final feedback form, with confetti on the phone for the top three only. While a showdown is still being played the card waits until it is decided.

## Testing Decisions

- **Test the decisions, not the look.** Vitest covers the live-change helper (first snapshot silent, forward move fires, Previous silent), the verdict card choice for each verdict and for no answer, the chime rate limit, reduced-motion fallback where it is a branch in code, the phone placing text including ties, and the mute setting reaching the sound registry.
- Backend Jest covers the teams-correct count (correct, partial, no answer, closest_guess has none) and the mute setting round-trip.
- The look is checked by hand in the running app (frontend :8888, backend :3000). No screenshot or animation-snapshot tests.

## Out of Scope

- Team colours or avatars — a domain change to be discussed separately.
- Sound on phones.
- A visual redesign (type, colour) beyond motion.
- Any change to the order of screens or the steps of a reveal.

## Further Notes

- New term: **Verdict** is in `GLOSSARY.md`. On screen a `partial` verdict reads "Close!"; the domain term stays "partial".
- Docs that change: `DOCUMENTATION.md` (teams-correct count in the display view, the mute setting), the `/guide` page (the mute toggle), `CODING_STANDARDS.md` (the motion rules).
- No ADR: every decision here is cheap to reverse.
