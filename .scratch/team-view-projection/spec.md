# Spec: One team view projection for the phone, on join and on every change

Status: ready-for-agent

Source: architecture review 2026-11-18, candidate 1 ("One team view projection for the phone"). It also takes in the phone half of candidate 4: the phone stops working out doubled rounds itself.

## Problem Statement

A team's phone holds the team's private state: its answers and their grades, bonus awards, joker, side, coins and carried coin, power-up purchases, Ask the room readiness, player count, round ratings, feedback and session ratings. The phone gets that state two different ways:

- **On join or reconnect**, as one full payload built in one place.
- **During play**, as eight separate per-team sync channels (answers, bonus awards, player count, joker, side, purchases, Ask the room readiness, coins). Each channel has its own outcome field, its own emit loop, its own event and its own reducer action on the phone.

Every change module that alters a team field must remember to add the right sync for it, and nothing checks that it did. If it forgets, the phone shows stale data until the next reconnect. A reconnect quietly "fixes" it, so the bug only shows up live on stage. Two shipped bugs were exactly this: coins not reaching the phones when the quiz started or the lobby settings changed, and grades not reaching the phones when a break was left into the results.

Each new team-level feature (jokers, coins, power-ups, Versus) paid this cost again, spreading one field across a dozen files.

The phone also does game logic. It stitches its view together from the room view plus its joker, purchases and side, then works out which rounds count double for it. The coding standards say clients do no game logic.

## Solution

The server builds one **team view**: everything a team's own phones may know about that team, worked out on the server. It sends the team view in two cases:

- when a phone joins or reconnects, as part of the join reply;
- whenever a write changes something about that team, as one team view event to that team's phones.

The live path and the reconnect path become the same path, so a change can't reach a rejoining phone yet miss a connected one. The phone replaces its team data wholesale with each team view it receives, and reads doubled rounds from it rather than working them out.

From the quiz master's and the teams' point of view nothing changes, except that a whole class of "my phone shows the wrong coins/joker/grade until I refresh" bugs goes away.

## User Stories

1. As a team, I want my phone to show my grades as soon as the results are revealed, so that I don't have to reload to see how we did.
2. As a team, I want my phone to show my grades when the quiz leaves a break into the results with Early answer reveal on, so that the verdicts appear with the leaderboard.
3. As a team, I want my coin balance to update the moment the quiz leaves the lobby, so that carried coins show before the first round.
4. As a team, I want my coin balance to update when the quiz master changes the lobby settings, so that the starting coins I see are the ones I have.
5. As a team, I want my coins to drop when a bonus award that carried a coin is deleted, so that I never plan a purchase with coins I don't have.
6. As a team, I want my joker to show on my phone as soon as I pick it, so that I know the pick landed.
7. As a team, I want the joker the server drew for us to show when the joker pick closes, so that I know which round counts double.
8. As a team, I want my joker to update when the quiz master fixes it, so that my phone never shows the wrong doubled round.
9. As a team, I want my joker to update when its round is deleted and redrawn, so that I'm not told a round that no longer exists counts double.
10. As a team, I want my phone to list every round that counts double for us, including an extra joker, so that I know where to take risks.
11. As a team, I want the doubled rounds to be the ones the server scores double, so that my phone and the leaderboard never disagree.
12. As a team, I want my side to update when I pick or switch it, so that I see which side I'm on.
13. As a team, I want my side to update when the quiz master moves us, so that I'm not shown on the wrong side.
14. As a team, I want my side to clear when Versus is turned off, so that my phone stops showing a side that no longer exists.
15. As a team, I want my purchases and coins to update together after I buy a power-up, so that the removed 50/50 options and my balance match.
16. As a team, I want the Ask the room button to appear on a question as soon as it's ready for us, so that I can use it while it's still useful.
17. As a team, I don't want to learn how many other teams answered from the Ask the room readiness, so that the power-up stays fair.
18. As a team, I want my bonus award list to update when the quiz master edits or deletes an award, so that my phone shows what we actually earned.
19. As a team, I want a toast when we're given a bonus award or coins, so that the moment feels like a reward.
20. As a team, I want my player count to update on every phone of the team when one phone changes it, so that all our phones agree.
21. As a team using two phones, I want the second phone to show everything the first shows, so that whoever holds a phone sees the same state.
22. As a team whose phone slept, I want everything restored on reconnect (answers, grades, joker, side, coins, purchases, ratings, feedback, player count, Ask the room readiness), so that I can carry on where I left off.
23. As a team that was kicked and rejoined with its team code, I want our team state restored, so that the escape hatch loses nothing.
24. As a team, I want a team view to arrive only on my own team's phones, so that no other team ever sees our joker, coins, purchases or side.
25. As a team, I want a team view never to include answers or grades the room view isn't allowed to show yet, so that nothing is revealed early.
26. As a team, I want "Saved ✓" to still appear only for my own phone's action, so that the feedback stays clear.
27. As a team, I want toasts, sounds and verdict cards not to fire again because a team view arrived after a reconnect, so that a reconnect doesn't replay the night.
28. As a team that changed an answer during a redeploy, I want my pending answer kept and resent after the rejoin, so that the team view replacing our data doesn't lose it.
29. As a quiz master, I want a live answer-key fix to reach each affected team's phone, so that the re-scored grades show without anyone reloading.
30. As a quiz master, I want grading a typed answer by hand to reach that team's phone at the moment grades are shown, so that the result is consistent.
31. As a quiz master, I want a team merge to leave the surviving team's phones with the merged state, so that the team sees its combined answers and coins.
32. As a developer adding a team-level field, I want to add it in one place (the team view) and have both join and live updates carry it, so that I can't ship a missed-sync bug.
33. As a developer writing a change module, I want to say only which teams changed, not how to tell them, so that the change module stays about the game rule.
34. As a developer, I want one test property ("the last team view a phone received equals what a fresh rejoin would get") to cover every kind of change, so that a new change module is checked by adding one case.
35. As a developer on the phone, I want one reducer action that replaces the team's data, so that a new field needs no new action, listener or reducer test.
36. As a developer, I want the phone to read doubled rounds from the team view, so that the joker rule has one owner on the server (ADR 0004).

## Implementation Decisions

### The team view projection

- A new projection, the **team view**, sits beside the existing screen and room-view projections. Given a session and a team, it returns everything that team's phones may know about the team.
- It holds: answers with their grades (redacted as today: nothing the players' room view may not show yet), bonus awards, round ratings, feedback, session ratings, player count, joker, side id, coin balance and whether it includes the carried coin, purchases, the ids of open questions on which Ask the room is ready for that team, and the team's **doubled rounds** (round id, round number, title; "" when the round was bought blind), in quiz order.
- It is **async and reads from the database** through the existing answer, bonus, purchase, feedback and player-count modules, exactly the reads the join reply makes today. Caching those lists in session state is out of scope.
- It can project many teams at once, with batched reads, because one write can change every connected team (an answer submit changes every team's Ask the room readiness; leaving the lobby changes every team's coins).
- Doubled rounds come from the existing shared doubled-rounds rule (joker round plus extra-joker purchases). The phone no longer calls that rule.
- The team view type lives in shared types, next to the join payload it replaces.

### The change module contract

- A session outcome drops its eight per-team sync fields (answers, bonus awards, player count, joker, side, purchases, Ask the room readiness, coins) and gains one field: the ids of the teams whose team view may have changed.
- Change modules report team ids only. They no longer build sync payloads or look up a team's socket.
- Erring on the side of listing a team is safe: an unchanged team view sent again only costs a send.
- Every place that set one of the removed sync fields lists those teams instead. This includes the moments `isRevealEntry` marks (entering reveal intro, quickfire's collapsed lock-to-reveal, leaving a break into results with Early answer reveal), live answer-key fixes, grading writes, joker picks and draws, side picks and moves, Versus turned off, purchases, coin-changing writes (leaving the lobby, lobby settings change, bonus award delete), bonus award edits and deletes, player count changes, merges, and every answer submit while Ask the room is offered (all connected teams).
- `isRevealEntry` keeps its job, deciding when grades become visible, but now feeds the changed-team ids.

### Delivery

- The single delivery step projects the team view once for each changed team that is connected, and emits one **team view** event to that team's socket. It does this after the room broadcasts, at the point where the per-team syncs go today.
- A team view is emitted only to that team's socket. It is never sent to the players room.
- These stay separate events because they carry a one-off effect that a view replace can't express: the bonus-awarded toast, the coin-awarded toast, the answer-received acknowledgement, and the save acknowledgements for joker, player count, rating, feedback and session rating. Each is sent alongside the team view.
- The eight per-team sync events are removed from the socket protocol, along with their payload types and declarations.

### The join reply

- The join reply becomes the team's identity (team id, token, code, name) plus its team view, built by the same projection as the live path.
- The join reply's hand-built field list and its own Ask the room readiness loop are deleted. The answer-submit path's readiness loop is replaced by the projection's.

### The phone

- The phone's team-link reducer gains one action that replaces the team data wholesale with a received team view. The join accept action takes its team data from the embedded team view.
- The per-sync reducer actions and their socket listeners are removed (answers, bonus awards, player count, joker, side, purchases, Ask the room readiness, coins).
- Optimistic and acknowledged values the phone holds (the pending answer and its attempt counter, a just-saved joker or player count) are kept across a team view replace. They follow the same rules the current sync actions use for them.
- The play screen reads doubled rounds and joker marks from the team view. The phone's own doubled-round derivation and joker extra-points calculation are deleted, apart from presentation that only formats server-given values.
- One-off effects keep going through the live-change helper. A team view arriving never fires a toast, sound or verdict card by itself.

### Docs

- `DOCUMENTATION.md`: replace the per-team sync events in the protocol section with the team view event, and describe the join reply as identity plus team view.
- `GLOSSARY.md`: add **Team view**: the server-built picture of one team's own state, sent to that team's phones on join and on every change to it.
- Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

- Good tests here assert what a phone receives through the socket and what the phone's reducer holds afterwards. They don't assert which change module listed which team, or how the projection reads its data.
- **Backend, through the existing socket interface with the real Postgres store** (the harness used across the game test suite). The main property is **live equals resync**: after a change, the last team view a connected phone received equals the team view in the join reply a fresh rejoin of that team gets at that moment. Write one case per kind of change: answer submit, grade by hand, live answer-key fix, reveal entry, quickfire collapsed reveal, break exit into results with Early answer reveal, joker pick, joker draw at pick close, joker fix, side pick, side move, Versus off, purchase, leaving the lobby, lobby settings change, bonus award edit and delete, player count change, merge, kick and rejoin.
- Backend privacy cases: a team view never reaches another team's socket; Ask the room readiness carries a flag only; answers not yet shown to players are redacted in the team view exactly as in the players' room view.
- Backend: toasts and acknowledgements still arrive alongside the team view.
- Prior art: the existing team answers sync and join specs in the game test suite. They become the live-equals-resync specs. The per-channel sync specs are deleted or folded in.
- **Frontend, through the team-link reducer** (its existing test seam): a team view replaces team data wholesale; the pending answer and attempt survive a replace; a stale acknowledgement doesn't overwrite a newer team view; join accept takes its data from the embedded team view. Prior art: the existing team-link reducer and team-data tests. The per-sync reducer tests are deleted.
- Frontend, through the play screen's existing tests: doubled rounds and joker marks render from the team view.
- There is no separate database-free test seam for the projection; the socket-level specs cover it. Shared-type tests of the doubled-rounds rule stay as they are.
- Run `pnpm crap:changed` and the backend database-backed mutation run for the delivery and projection modules before closing.

## Out of Scope

- Caching answer, bonus or purchase lists in session state to avoid database reads.
- Sending a team view only when its content actually changed (diffing against the last one sent).
- Joker doubling in standings, ended-session reads and fun facts (the rest of candidate 4). That includes checking whether fun facts count the extra joker.
- The admin room's answer-list update and the room-view broadcasts. Only the per-team channels change.
- Collapsing the game-state and gateway pass-through modules (candidate 3) and the transition-effects module (candidate 2).
- Any change to what teams see on screen.

## Further Notes

- ADR 0004 is upheld: doubling stays derived, never stored. The team view just carries the derived doubled rounds, so the phone stops deriving them.
- Performance: with Ask the room offered, each answer submit projects every connected team (around 30 teams × a handful of batched reads). This is accepted at pub-quiz scale (single instance, by design). If it shows up in the dev log as slow, the upgrade path is the diffing listed under Out of Scope, not new per-field channels.
- The removed socket events change the protocol between backend and phone. Both apps deploy together, so no compatibility shim is needed. A phone still running the old bundle after a deploy would miss team views until it reloads; check how existing protocol changes handled that before shipping.
