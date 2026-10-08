# 02: Team feedback change module

**What to build:** A team rating a round, and a team sending its comment and topic suggestions, behave exactly as today. The team feedback change module now builds both, following the pattern from ticket 01.

The module owns the shared gate both events use, and its checks keep their order, all of them before the feedback is stored:

1. The socket belongs to a team.
2. Feedback is collected for this session.
3. The round, or the final form, is open.

Refusal messages stay the same word for word, so a rating sent as the break ends is either stored or refused, never stored late.

The nothing-to-push outcome (acknowledged to the sender only) moves into this module, since it is the only user. Both façade methods are one `write` call with the "doesn't touch scores" option. The module takes only the feedback service.

Parent spec: `.scratch/live-session-changes/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] Round rated and feedback sent are built by the team feedback change module. Their façade methods are each a single `write` call carrying the "doesn't touch scores" option.
- [ ] The nothing-to-push outcome lives in the team feedback change module, and the game state class no longer defines it.
- [ ] The module imports neither the Session write module nor the game state class.
- [ ] Every existing backend spec passes without edits, in particular rate-round, send-feedback, feedback-write-gates, collect-feedback-setting and display-feedback-prompt.
- [ ] `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
