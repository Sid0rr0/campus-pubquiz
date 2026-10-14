# 03: Reveal — answer entrance, teams-correct count, phone verdict card

**What to build:** Spec: `.scratch/player-polish/spec.md`, "Reveal". (1) An answer entrance per answer kind on the big screen's reveal: options light up/dim, typed and number pop in, sort slides into order, match pairs settle, closest_guess step lines slide in as they arrive (no new steps). Plus a reveal sting from the sound registry. (2) The display view's reveal gains a teams-correct count for the revealed question: teams with a `correct` verdict, with `partial`, and teams in the session; none for closest_guess. Drawn as a count-up "7 of 12 teams" with "+2 close" when partials exist. (3) Each phone shows a self-dismissing (~3 s), non-blocking verdict card when the big screen lands on a revealed question, regardless of auto-advance: "✓ Correct +2", "Close! +3", "✗ +0" or "No answer"; vibrates on correct only. Effects go through the live-change helper. Update `DOCUMENTATION.md` for the new display-view field.

**Blocked by:** 01

**Status:** done

- [x] Backend: count counts correct and partial verdicts separately, totals all teams in the session (no-answers included), and is absent on closest_guess (Jest, test first)
- [x] Phone: card picks the right text for correct, partial, incorrect and no answer (Vitest)
- [x] Phone: card shows with auto-advance off
- [x] Phone: no card or vibration on reconnect into a reveal, or on Previous
- [x] Display: entrance per answer kind; reduced motion falls back to crossfade
- [x] `DOCUMENTATION.md` updated

## Comments

- The reveal sting plays through `displaySounds.play('reveal')`; `reveal.mp3` is still a human TODO (ticket 01), a missing file fails silently.
- The teams-correct count comes from a new ephemeral `SessionState.verdictTallies`, re-read with the standings at the end of every session write and on placement. `teamCount` is the leaderboard length (roster teams), because `session.teams` is only filled as teams join and is empty after a restart.
- Entrances are `motion` components inside `MotionConfig reducedMotion="user"`: transforms are skipped under reduced motion and what remains is an opacity fade. The look is not covered by tests; check it by hand (frontend :8888).
- The display's forward-move position is `revealPosition(progress)` (`app/lib/reveal-position.ts`); the phone's is the count of fully revealed questions in its own view.
