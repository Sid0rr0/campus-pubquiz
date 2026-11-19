# 01: Team view projection, sent on join and on change, alongside the old channels

**What to build:** A team's phones receive one **team view** (everything that team's phones may know about the team, worked out on the server) whenever they join and whenever a write changes the team. This is the expand step: the eight existing per-team sync channels keep running unchanged beside it, so nothing breaks, and later tickets move the channels over one group at a time. See the spec's "The team view projection", "The change module contract" and "Delivery" sections.

- The server builds the team view for one or many teams with batched database reads: answers with grades (redacted exactly as in the players' room view), bonus awards, round ratings, feedback, session ratings, player count, joker, side id, coin balance and carried-coin flag, purchases, Ask the room readiness, and doubled rounds (from the shared doubled-rounds rule) in quiz order.
- A session outcome gains a "changed team ids" field. The single delivery step projects and emits one team view event to each changed team that is connected, only to that team's socket, after the room broadcasts.
- The join reply carries the team view next to its existing fields, built by the same projection.
- The phone's team-link reducer replaces the team's data wholesale from a received team view, and join accept takes its data from the embedded team view. The pending answer, its attempt counter and acknowledged values survive a replace. A team view never fires a one-off effect.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The team view type lives in shared types; the team view event is declared in the socket protocol
- [ ] Session outcomes carry changed team ids; delivery emits a team view only to each listed, connected team's own socket
- [ ] The player count change lists its team, and its live-equals-resync spec passes: the last team view the phone received equals the team view in a fresh rejoin's join reply
- [ ] A reusable live-equals-resync helper exists for the backend socket specs, used by later tickets
- [ ] A team view never reaches another team's socket (backend spec)
- [ ] Reducer tests: a team view replaces team data; the pending answer and attempt survive; join accept reads the embedded team view
- [ ] The old sync channels still work; existing specs pass unchanged
- [ ] `GLOSSARY.md` gains the **Team view** term
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
