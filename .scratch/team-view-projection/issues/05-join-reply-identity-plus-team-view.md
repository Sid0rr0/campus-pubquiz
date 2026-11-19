# 05: The join reply becomes identity plus team view

**What to build:** The contract step. The join reply is the team's identity (team id, token, code, name) plus its team view and nothing else, so joining and live updates share one path. The old per-field join data is dropped from the join payload, from the server's hand-built join reply, and from the phone's join-accept handling. Also settle the spec's open item: how a phone still running the old app version behaves right after a deploy that removes the old events.

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] The join payload type holds identity plus team view only; the hand-built field list in the join reply is gone
- [ ] Live-equals-resync spec: kick and rejoin with the team code restores the team view
- [ ] Reconnect after a sleep restores everything (existing reconnect specs pass, adjusted to the new payload)
- [ ] The old-bundle-after-deploy behaviour is checked and recorded in a comment on this ticket (and fixed if it leaves a phone stuck)
- [ ] `DOCUMENTATION.md` describes the join reply as identity plus team view
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm crap:changed` and `pnpm --filter backend mutate:db` for the delivery and projection modules run; survivors reviewed
