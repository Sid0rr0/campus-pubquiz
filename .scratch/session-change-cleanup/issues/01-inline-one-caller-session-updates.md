# 01: Inline the one-caller session updates

**What to build:** The session-updates module in the Live session module keeps only the updates that carry a rule. The one-field helpers with a single caller become inline spreads in that caller: `withTeams`, `withTeamConnected`, `withoutTeamConnection`, `withAnsweredTeamIds`, `withBreakEndTime`, `withDisplayTextScale`, `withDisplaySoundMuted` and `withShowdownGuess`. `withShowdownGuess`'s two rules move inline with it: a guess with no active showdown round is a no-op, and a new guess replaces the previous one.

`requireSeat`, `seatOfSocket`, `withActiveShowdownRound` and `withPlayerCount` stay. `withPlayerCount` has two callers and the rule that a null count leaves the cache alone. The module's header is rewritten to say what it holds: seat lookups and the session updates that carry a rule. It no longer promises a derived-cache guarantee the module doesn't keep.

Teams, the quiz master and the big screen see no difference. See the spec's Implementation Decisions.

**Blocked by:** None (can start immediately). The whole spec waits for `team-view-projection`.

**Status:** ready-for-agent

- [ ] The eight helpers no longer exist, and each former caller does the same update inline.
- [ ] A showdown guess with no active round still changes nothing, and a resubmitted guess still replaces the old one (the existing showdown specs pass).
- [ ] `requireSeat`, `seatOfSocket`, `withActiveShowdownRound` and `withPlayerCount` keep their interfaces, and the module header describes them truthfully.
- [ ] The existing change-module and gateway specs pass with no edits.
- [ ] `pnpm crap:changed` and `pnpm --filter backend mutate:changed` are clean on the touched files.
