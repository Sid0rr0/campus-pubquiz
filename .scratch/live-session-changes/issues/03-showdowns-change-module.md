# 03: Showdowns change module

**What to build:** A team's showdown guess and the quiz master starting a new showdown round behave exactly as today. The showdowns change module now builds both, following the pattern from ticket 01.

**Showdown guess.** It keeps its checks in order, all before the guess is stored:

1. The showdown is still accepting guesses.
2. The socket owns the team's seat.
3. The team takes part in this showdown.

A guess sent as the reveal starts is either counted by the resolve or refused.

**New showdown round.** It reads the teams tied for first from the leaderboard of the session the write holds, so a round is only created for teams still tied. It leaves the leaderboard flag alone.

**Shared refusal.** The module owns the translation that turns an invalid showdown error from the showdown service into a refusal, used by both events. Both façade methods are one `write` call with the "doesn't touch scores" option. The module takes only the showdown service.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] The showdown guess and the new showdown round are built by the showdowns change module. Their façade methods are each a single `write` call carrying the "doesn't touch scores" option.
- [ ] The invalid-showdown-to-refusal translation lives in the showdowns change module only.
- [ ] Refusal messages are unchanged word for word.
- [ ] The module imports neither the Session write module nor the game state class.
- [ ] Every existing backend spec passes without edits, in particular:
  - showdown-socket, showdown-write, showdown-reveal,
  - the session-write spec's showdown and new-showdown-round cases.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
