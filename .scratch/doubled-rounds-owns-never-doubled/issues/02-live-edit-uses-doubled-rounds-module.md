# 02: Live edit gets doubled rounds from the Doubled rounds module

**What to build:** The **Doubled rounds** module gains a session-wide variant of `doubledRoundIdsOfTeam`. Given a session's jokers and its purchases (each with a `teamId`), it returns every round some team doubles, each once. It is defined as the union of `doubledRoundIdsOfTeam` over every team with a joker or a purchase.

**Live edit**'s Clue-on-doubled-round guard gets its doubled rounds from this function, reading the same sources as now (`session.jokers` and `session.funFactData.powerUps`). It drops its own way of collecting them, and keeps only the mapping to each round's question ids and Clue question ids. The guard's interface doesn't change.

The quiz master sees the same blocks: adding a Clue question to a round any team doubles is refused with the same message, and adding one to an undoubled round still saves.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The Doubled rounds module exports the session-wide function. `doubled-rounds.test.ts` covers:
  - an empty session
  - a joker only
  - an extra joker only
  - a joker and an extra joker on one round (counted once)
  - two teams doubling different rounds (union)
  - a purchase that isn't an extra joker (ignored)
- [ ] The Live edit service no longer builds its own set of doubled rounds from jokers and power-up rows.
- [ ] The backend's existing extra-joker Live edit spec and the Live edit guard spec pass without edits. If one fails, stop and report the drift; don't change the test.
- [ ] `pnpm typecheck`, the affected tests and `pnpm crap:changed` pass.
