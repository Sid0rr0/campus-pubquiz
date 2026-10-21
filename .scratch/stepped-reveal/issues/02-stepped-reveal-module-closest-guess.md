# 02: The Stepped reveal module, with the closest-guess reveal on it

**What to build:** A **Stepped reveal** module in shared types owns stepping for whichever stepped reveal is on air. The closest-guess reveal is its first user, and walks exactly as it does today. The module:

- says which stepped reveal is on air, if any
- steps it on Advance or Previous: a new step, a hold, a fall-through to the state machine, or a wait when a first-Advance guard refuses
- says whether a press reached the final step
- gives the start step for a reveal landing forward or backward
- reads "the step of reveal X" (0 when X isn't on air)

The closest-guess reveal supplies only a descriptor: its step count (one plus one per line when someone guessed, else 1), falling through at both ends, and no guard. Its lines (smallest, highest, answer, closest) stay where they are and keep taking a step number. The Move plan's `closest_guess_step` becomes a `reveal_step` that names the reveal it stepped. Commit a move and the presenter preview handle `reveal_step` for the closest guess. The session still has both counters in this ticket. See the spec's Implementation Decisions (Stepped reveal module, What each reveal supplies, Move plan).

**Blocked by:** 01 (A reveal's step survives the leaderboard and the join overlay)

**Status:** done

- [ ] Pure tests for the module over a test descriptor cover:
  - forward and backward bounds
  - hold vs. fall-through at each end
  - a first-Advance guard that waits
  - the start step landing forward and backward
  - the final-step flag
  - reading a reveal's step when it isn't on air
- [ ] The closest-guess interceptor and start-step function are gone. The Move plan, the settle step and the screen projection reach the closest-guess reveal only through the module.
- [ ] The Move plan has no `closest_guess_step`. A closest-guess press plans a `reveal_step`. Commit a move still saves nothing for it and never runs the state machine.
- [ ] The closest-guess reveal, players-reveal-redaction, presenter-context and action-availability gateway specs, and 01's new tests, pass unchanged.
- [ ] `pnpm typecheck` and the shared-types, backend and frontend tests pass.
