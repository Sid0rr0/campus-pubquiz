# 03: The team-link reducer holds one team view

**What to build:** The phone keeps one copy of its team data: the team view from the join reply, replaced wholesale by each team view it receives. The separate team fields (answers, bonus awards, round ratings, feedback, session ratings, player count, joker, doubled rounds, joker extras, side, purchases, Ask the room readiness), their empty values and the step that copies a team view into them are deleted. The hook works out answers keyed by question and ratings keyed by round from the held team view and keeps its current names, so the play screens don't change. Clearing the team drops the held team view. The pending answer and attempt counter stay outside it. The joker notices compare the held team view's joker with the incoming one. Nothing a team sees changes. See the spec's "The phone's team link holds one team view".

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The team-link state has no team data outside the held team view
- [ ] Reducer tests: join accept holds the embedded team view; a team view replaces it wholesale; the pending answer and attempt survive a replace; clearing drops it; joker notices fire on drawn/moved, not chosen
- [ ] The play screens' existing tests pass unchanged, or with fixture-only changes
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass; frontend mutation run on the team-link reducer shows no new survivors
