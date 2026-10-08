# 04: Bonus awards change module

**What to build:** The quiz master awarding a bonus over the socket, and a bonus award added, edited or deleted over REST (bonus changed), behave exactly as today. The bonus awards change module now builds both, following the pattern from ticket 01.

**Award.** It checks the session's own enabled bonus categories and per-category limit through the bonus service, inside the write. An invalid bonus award becomes a refusal carrying the bonus service's message.

**Shared bonus change.** Both events use it, and it is private to the module. It refreshes the leaderboard the same way grading does. Only a fresh award carries the BONUS_AWARDED notice, and only to the awarded team's socket, if it is connected.

Both façade methods are one `write` call that reads standings, as today. The module takes only the bonus service.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Award bonus and bonus changed are built by the bonus awards change module. Their façade methods are each a single `write` call.
- [ ] The shared bonus change is private to the module. Only a fresh award produces BONUS_AWARDED.
- [ ] The invalid-bonus-award-to-refusal translation lives in the module, and messages are unchanged.
- [ ] The module imports neither the Session write module nor the game state class.
- [ ] Every existing backend spec passes without edits, in particular:
  - award-bonus, bonus-changed, grade-and-bonus-write, the bonus awards controller spec,
  - the session-write spec's bonus cases.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
