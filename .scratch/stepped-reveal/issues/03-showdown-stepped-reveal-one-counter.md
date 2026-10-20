# 03: The showdown on the Stepped reveal, with one counter

**What to build:** The showdown reveal moves onto the Stepped reveal module, and the session keeps one step counter for both reveals. The showdown supplies a descriptor:

- its step count: one per seat plus the final answer-and-winner step
- it holds at both ends: a repeated Advance on the last step does nothing, and so does Previous on the first
- its first-Advance guard: every seat has guessed, else the press waits

Its disclosure (guesses per seat, then answer and winner) stays per reveal.

The session's `closestGuessRevealStep` and `showdownRevealStep` become one ephemeral `revealStep`. Starting a showdown round no longer writes the counter unless the showdown is the reveal on air. Entering `ended` starts it at 0. Showdown guess acceptance, the showdown view, the On-air screen's guessing/reveal choice and the screen key read the showdown's step through the module. That way, composing a showdown during the last block's closest-guess reveal disturbs neither reveal.

The Move plan's `showdown_step` becomes `reveal_step`. `showdown_waiting` stays. Commit a move resolves the showdown when a showdown `reveal_step` reaches the final step. The presenter preview keeps "Reveal step N" for the showdown. On the wire, the display and admin views keep `showdownRevealStep` and the showdown Display screen keeps `step`, now read through the module. See the spec's Implementation Decisions (Session state, Move plan, Commit a move, Wire unchanged, Docs).

**Blocked by:** 02 (The Stepped reveal module, with the closest-guess reveal on it)

**Status:** ready-for-agent

- [ ] The showdown interceptor and its own step count are gone. The Move plan has no `showdown_step`. The session has only `revealStep`.
- [ ] The existing showdown reveal and showdown socket gateway specs pass unchanged:
  - no intercept before `ended`
  - Advance waits while a guess is missing
  - the walk resolves on the final step with a leaderboard refresh
  - Previous doesn't resolve
  - guesses are refused once the reveal starts
- [ ] New gateway cases:
  - composing a showdown during a closest-guess reveal leaves that reveal's step and trimmed lines alone, and the showdown accepts guesses after END_QUIZ and starts at its first step
  - a sudden-death round starts at its first step with its guesses hidden
  - showing and hiding the leaderboard mid-showdown keeps the step
- [ ] The display, admin and players views, and the phone's showdown screens, show the same steps as before (existing display, room-view-fields, players-phone-screen and frontend showdown tests pass).
- [ ] `GLOSSARY.md` gains **Stepped reveal**. **Closest-guess reveal**, **Showdown** and the Move plan entry point at it. `DOCUMENTATION.md` no longer names two counters.
- [ ] `pnpm typecheck` and the shared-types, backend and frontend tests pass.
