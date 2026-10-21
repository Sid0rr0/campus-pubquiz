# 02: Big-screen sounds follow the Display screen

**What to build:** The big screen's round sting, reveal sting, time-up and end fanfare (with confetti) play from the Display screen transition the big screen sees, not from the session's status. A pure sound table, `soundFor(previous, next)`, names the sound for a move from one Display screen to the next. One hook on `/display` feeds the view's screen position (ticket 01) to the existing live-change gate. On a live forward move it plays the table's sound through the display sound registry. It fires confetti with the fanfare, and skips the fanfare if the final leaderboard has already crowned a winner live. This replaces the page's three status-based triggers and `useRoundTitleSting`. The client's two copies of the quiz's order (`revealPosition` and the sting's status → phase table) are deleted. See the spec's Implementation Decisions (Display sounds module, One hook on `/display`).

**Blocked by:** 01 (The display view carries a screen position)

**Status:** done

- [ ] `soundFor` returns `sting` for a move onto `round_title`, `reveal` onto `reveal`, `timeUp` from `question`/`locking` onto a screen after the lock (`break_intro`, `break_review`, `break_round_title`, `reveal_intro`, `reveal`), `fanfare` onto `ended`, and `null` otherwise. Pure tests cover each row, plus the `null` cases (question → question, question → locking, `break_round_title`, `reveal_intro`, overlays).
- [ ] `/display` makes no sound decision from `progress.status`. `useRoundTitleSting`, its test, `revealPosition` and its test are deleted. Any order cases worth keeping have already moved into 01's walk test.
- [ ] The existing display sound page tests (time-up, reveal moment, ended moment, showdown sounds) pass, apart from fixture tweaks.
- [ ] New `/display` page tests (mocked `useDisplayGame` and `displaySounds`, views from `roomView`) cover:
  - the round sting on Advance onto a round intro, but not onto the break round intro or the reveal intro
  - one reveal sting per revealed answer, none for closest-guess steps
  - time-up once at the lock, not again through the break
  - fanfare and confetti on ending the quiz, none when a winner was already crowned live
  - silence on Previous, on the first snapshot after load or reconnect, on overlay toggles, and for moves made while an overlay covers the screen
- [ ] After an end-of-quiz showdown, returning to the ended screen doesn't replay the fanfare.
- [ ] The big-screen mute and the "Enable sound" unlock still silence these sounds, because they go through the registry, which is unchanged.
- [ ] The leaderboard drumroll and winner fanfare, the showdown slam and burst, the lobby chime and the lock countdown are unchanged.
- [ ] `pnpm typecheck` and the frontend tests pass.
