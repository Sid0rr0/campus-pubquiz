# Spec: Every REST change to a live session goes through the Live session module

Status: ready-for-agent

Blocked by: — (follows live-session-events, live-results-read and bonus-award-toast, all done)

Source: architecture review 2026-10-20 ("Out of Scope, revisited"), candidate 1 ("Strong", in-process). It picks up Out of Scope items from `live-session-events` (REST bonus routes onto the award path), `live-results-read` (refreshing a league top when another session in the league ends) and `bonus-award-toast` (telling a connected phone about an edited or deleted award).

## Problem Statement

A quiz master who edits or deletes a **bonus award** from the control panel's bonus drawer changes the database first, outside the **Session write**. Only afterwards does the change ask the Live session module to refresh the leaderboard, and then it hands that outcome to the delivery step itself. Another write to the same session can land between the two. The edit is also the only bonus path that isn't checked against the session as the previous write left it.

The team whose award changed never finds out. Its phone keeps showing the old points and reason in its bonus list until it rejoins. A fresh award reaches the phone at once (the toast and the list), but an edit or a deletion does not.

When a session ends, its result starts counting in its leagues' **league tables**. Every other live session in one of those leagues keeps showing a stale **league top** in its big screen lobby. The same happens when an ended session is un-ended, or when its scores change after it ended. Today a league top is re-read only when a session is placed or after a REST league edit.

On the code side, five REST routes each check that the session exists, read the game session id, call a service, and then decide by hand what to push to clients. The leagues controller loops over join codes and broadcasts each one itself. The rule "every change to a live session goes through the Session write, and one delivery step pushes its outcome" holds for socket events, phase timers and the Live edit save. It doesn't hold for REST.

## Solution

Every REST request that reads or changes a live session goes through one REST-facing entry to the Live session module. Each controller makes one call. For a change, that call writes inside the Session write, then hands the outcome to the delivery step.

- Editing or deleting a bonus award runs inside the Session write, the same way awarding one already does. No other write can land in between.
- The awarded team's phone gets its updated bonus list at once when an award is edited or deleted. It shows no toast: only a fresh award toasts.
- When a session enters or leaves `ended`, or a write that touches scores lands while it is `ended`, every other live session re-reads its league top. The big screen lobbies whose league top changed are redrawn. This happens the same way whether the session ended through the control panel, a phase timer or anything else.
- A REST request for a session that doesn't exist, or that was closed while the request waited in the queue, gets a 404, the same way on every route.

Nothing the quiz master sees on `/control` changes, apart from the phone and lobby updates above now arriving live.

## User Stories

1. As a quiz master, I want an edit to a bonus award to be applied in order with every other change to the session, so that a grade or another bonus landing at the same moment can't leave the leaderboard showing a mix of the two.
2. As a quiz master, I want deleting a bonus award to be applied in order with every other change to the session, so that the leaderboard never briefly counts an award that is already gone.
3. As a quiz master, I want the leaderboard on `/control`, `/display` and `/remote` to show an edited bonus award's new points straight away, so that I can confirm the edit took.
4. As a quiz master, I want the leaderboard to drop a deleted bonus award straight away, so that a penalty I removed by mistake doesn't linger on the big screen.
5. As a team on a phone, I want my bonus list to show an award's new points and reason as soon as the quiz master edits it, so that I'm not looking at points we no longer have.
6. As a team on a phone, I want a deleted award to disappear from my bonus list straight away, so that I don't think we still have points the quiz master took back.
7. As a team on a phone, I want an edit or a deletion to update my list without a toast, so that a correction doesn't read as a fresh award.
8. As a team on a phone, I want a fresh award to keep its toast, so that nothing I'm used to goes away.
9. As a team whose phone is disconnected when an award is edited, I want the rejoin to restore the correct list, so that I catch up as I do today.
10. As a team, I want only my own phone to hear about my bonus awards, so that other teams don't see what we were given or why.
11. As a quiz master, I want a refused edit (zero points, or a custom award with no reason) to be rejected with the same message as today, so that the drawer still tells me what to fix.
12. As a quiz master, I want an edit or deletion of an award that doesn't belong to this session to be refused as "not found", as today, so that I can't change another night's awards from this session's drawer.
13. As a quiz master, I want a refused edit to change nothing and push nothing, so that the leaderboard and phones stay as they were.
14. As a quiz master, I want the bonus drawer's list of a team's awards to keep working while the session is live, so that I can find the award to correct.
15. As a quiz master, I want a bonus edit on a session that was closed while my request waited to come back as "not found" rather than a server error, so that the control panel shows a sensible message.
16. As a quiz master running two sessions in the same league, I want the second session's lobby to show the updated league top as soon as the first session ends, so that teams waiting in the lobby see the current table.
17. As a quiz master, I want a lobby's league top to update when I undo a session's end with Previous, so that the table no longer counts a night that isn't over.
18. As a quiz master, I want a lobby's league top to update when I correct a grade or a bonus award on a session that has already ended, so that the league table on screen reflects the correction.
19. As a quiz master, I want a session ending through a phase timer to refresh other lobbies too, so that it doesn't matter how the quiz reached its end.
20. As a quiz master, I want lobbies whose league top didn't change to receive nothing, so that unrelated big screens aren't redrawn.
21. As a quiz master, I want a failed league read for one session to leave that lobby's league top as it was and not fail the change that set it off, so that ending a quiz never fails because of a league read.
22. As a quiz master, I want the session that just ended to keep its own end screen exactly as today, so that the league refresh doesn't disturb the night's finale.
23. As a quiz master, I want a session closed during a league refresh to be skipped quietly, so that closing one session never breaks another's update.
24. As an admin, I want editing, deleting, or adding or removing sessions from a league to keep refreshing every live lobby as today, so that league edits still show up straight away.
25. As an admin, I want changing a live session's lobby settings or leagues to keep refusing with the same conflict message once the game has started, so that the session form behaves as before.
26. As an admin, I want closing a session to keep being refused while the quiz is still in progress, so that I can't strand teams mid-game.
27. As an admin, I want closing a session to keep telling every phone that the session closed, so that phones don't hit an opaque error later.
28. As a quiz master, I want the answer list for a question on `/control` to keep loading from REST as today, so that grading screens work after a reload.
29. As a quiz master, I want every REST route for an unknown join code to answer with the same 404 message, so that the control panel handles a missing session one way.
30. As a developer, I want each REST controller to make one call per route into the Live session module, so that a new REST route can't forget to deliver its outcome or pair the wrong outcome with its write.
31. As a developer, I want the "does this session exist" check to live in one place, so that the six copies in the controllers go away.
32. As a developer, I want the league refresh after a session ends to be decided by the Session write from a before/after comparison, the same way the deadline change is, so that no event has to remember to ask for it.
33. As a developer, I want the delivery step to be the one place that turns "league tables changed" into lobby broadcasts, so that the leagues controller doesn't keep its own broadcast loop.
34. As a developer, I want the REST bonus path and the socket award path to share one bonus change module, so that the rules for what a bonus change pushes live in one file.
35. As a developer, I want to test REST changes through the same real-store harness as socket events, so that a REST test proves the same write, outcome and delivery as production.

## Implementation Decisions

### A REST entry to the Live session module

- A new injectable in the game module, beside the Live edit service. It composes the game state service (the Live session module's front) and the Session broadcaster, the same way the Live edit service does. The broadcaster already depends on the game state service, so the game state service can't deliver its own outcomes. This new module is the layer above both.
- Each REST route calls one method on it. For a change, the method runs the change through the game state service (inside the Session write), then hands the outcome to the broadcaster's delivery step, and returns whatever the route returns.
- Methods, named by what the quiz master does:
  - **list a team's bonus awards** (admin view) for a live session
  - **edit a bonus award** (points, reason), returning the updated admin view
  - **remove a bonus award**
  - **list a question's answers** with its admin question context
  - **update session settings and leagues**
  - **close a session**, then send the session-closed notice
  - **refresh league lobbies**, for the leagues controller after a league write
- An unknown join code, whether missing up front or closed while queued, is one typed error from this module (an "unknown live session" error), not a `NotFoundException`. Each controller maps it to a 404 with today's message. A shared helper next to the existing league HTTP mapping does that mapping, so the six inline `hasSession` checks go. The "closed meanwhile" re-check in the sessions controller moves into the module.
- The controllers keep body parsing and validation (Zod schemas, `ParseIntPipe`), guards, roles and HTTP status mapping. Nothing about the routes, their guards or their request and response shapes changes.

### Bonus edits and deletions inside the Session write

- The game state service gets `editBonus(joinCode, awardId, points, reason)` and `removeBonus(joinCode, awardId)`, each one Session write, alongside the existing `awardBonus`. `bonusChanged` goes away: nothing calls it once the controller doesn't.
- The bonus awards change module grows `edit` and `remove` changes next to `award`. Each calls the bonus service with the session's own game session id, inside the write. Each maps the service's invalid-award error to a session refusal with the same message. A not-found award becomes its own refusal type so that the REST entry can map it to a 404 and keep today's behaviour. The `changed` change goes.
- Every bonus change refreshes standings, as today.
- The bonus service's `remove` returns the removed award's team id (or the module reads it first, inside the write), so the change knows which team to sync. `update` already returns the admin view, which carries the team id.

### The phone's bonus list syncs live

- A new server-to-client event, a team bonus awards sync, carries the team's full bonus award list. It uses the same `TeamBonusAwardView` list shape that the join-accepted payload's bonus awards use, in award order.
- The session outcome gets a per-team bonus sync list. It follows the same pattern as team syncs and player count syncs: connected teams only, each with its socket, built from the session's connected team sockets. An edit or deletion adds the award's team. A team with no connected socket gets nothing and catches up on rejoin, as today.
- The delivery step reads each listed team's awards (the bonus service's existing per-team list) and emits the sync to that socket only. It is delivered with the other per-team syncs, before the notices.
- A fresh award keeps its `BONUS_AWARDED` notice. The phone appends the award and shows the toast, as today. It does not also get a sync.
- On the phone, the team link replaces its bonus award list with the synced list and shows no toast. The bonus drawer re-renders from the team link as today.

### League tops refresh when a league table may have changed

- The session outcome gets a "league tables changed" flag. Only the Session write's commit step sets it, from a before/after comparison of the stored session, the same way it fills the deadline change. No event sets it by hand. It is set when:
  - the status enters `ended` or leaves it (END_QUIZ, the natural end after the last reveal, Previous from `ended`), or
  - the status was `ended` before and after the write and the write refreshed standings (a grade, a bonus change or a showdown result after the end).
- The held write the Live edit uses goes through the same commit, so a live edit that regrades an ended session also sets it.
- The delivery step, after delivering the outcome to its own session, runs the existing league-top refresh over every other live session when the flag is set. It sends a state broadcast to each session whose league top changed. This lives in the broadcaster, which already owns deliveries no socket sent. The refreshing session itself is skipped: its lobby isn't showing, and its own league top is read at placement.
- The refresh keeps today's per-session rules: a failed league read leaves that session's league top as it was (logged), a session closed meanwhile is skipped, and the triggering outcome's delivery is never failed by it.
- The leagues controller's private broadcast loop goes. After a league write it calls the REST entry's "refresh league lobbies", which runs the same refresh and broadcast for every live session.

### Glossary and docs in the same change

- `GLOSSARY.md`, **Live results**: the sentence "It is read at placement and on league changes only" becomes "at placement, on league changes, and when another session's league table may have changed (it ended, was un-ended, or its scores changed after it ended)".
- `GLOSSARY.md`, **Session write**: add the league-tables-changed flag alongside the deadline change it mirrors.
- `GLOSSARY.md`, the delivery step's entry: add the team bonus awards sync, and "a REST change" to the list of things that end there.
- `GLOSSARY.md`, **Team link**: the team's own bonus awards are kept current live, not only at join.
- `DOCUMENTATION.md`: the protocol section gets the new server-to-client event and its payload.
- No change to the `/guide` page: the quiz master does nothing differently.

## Testing Decisions

- A good test drives the system the way a client does and asserts what clients receive: the snapshots, the per-socket emits and the HTTP results. It never asserts which collaborator ran or in what order internals were called.
- **One seam: the real-store harness** (gateway, game state service, Session broadcaster over real Postgres and real migrations). REST changes are driven by calling the new REST entry module from that harness, the way socket events are driven by calling the gateway handler. The harness builds the module from the same providers as production.
- Behaviours to cover through the harness:
  - An edited award shows its new points in the next snapshot to all three rooms. The awarded team's socket gets the bonus awards sync with the new list. No other socket gets it, and no `BONUS_AWARDED` notice goes out.
  - A deleted award drops out of the leaderboard, and the awarded team's socket gets a sync without it.
  - A disconnected team gets no sync, and a later rejoin's join-accepted payload carries the current list.
  - A refused edit (zero points, custom with no reason, an award from another session) stores nothing and emits nothing.
  - Ordering: an edit queued behind a held write (the harness's existing hold-the-next-write helper) is applied after it, and the snapshot that follows reflects both. This is the race the move closes.
  - An unknown or closed-meanwhile join code is the typed unknown-session error on every method.
  - Two sessions in one league: ending the first through the admin action redraws the second's lobby with the new league top. Previous from `ended` redraws it again. A bonus edit on the ended session redraws it. A grade or bonus change on a session that isn't ended sends the second session nothing. A phase-timer-driven end behaves like the admin action.
  - A session in a different league, or whose league top didn't change, receives no broadcast from the refresh.
  - A failing league read for the other session leaves its league top unchanged and still delivers the first session's outcome.
- Prior art: `bonus-changed.spec.ts` and `award-bonus.spec.ts` (bonus through the harness). `bonus-changed.spec.ts`'s REST cases, which today call the bonus service and then deliver by hand, are rewritten against the new entry. `league-top.spec.ts` (league tops through the harness, including the closed-meanwhile skip). `notify-session-closed.spec.ts` (the close notice). `outcome-delivery-order.spec.ts` (where the new sync sits in delivery order). The hold helpers in `real-store-test-utils.ts`.
- Controller specs (bonus awards, sessions, leagues, answer) shrink to HTTP mapping against a stubbed REST entry. They check that the typed unknown-session error becomes a 404, an invalid-award refusal a 400, a not-found award a 404, and a blocked close or settings change a 409, and that each route makes its one call. They no longer stub `hasSession`, `getGameSessionId` or the broadcaster.
- Frontend: a team link test (Vitest, alongside `team-link-team-data.test.ts`) that the bonus awards sync replaces the list and raises no toast.
- No new E2E journey. If one already covers the bonus drawer, it keeps passing unchanged.

## Out of Scope

- **A concurrency seam on the Session write** (review candidate 2: an injected write gate in place of the `watchNextWrite` and monkey-patch helpers). The ordering test here uses today's hold helpers. Candidate 2 is the natural follow-up, and these tests will move onto it.
- **Toasting edits or deletions** on the phone, or showing bonus awards on `/display`.
- **Changing which bonus fields can be edited** (category stays fixed) or the bonus rules (categories, per-category limit, earning deadline).
- **Session creation** (`POST /sessions`). It already places the session through the Session write and pushes nothing to existing sessions.
- **The public session list and other reads** that don't touch a live session's state beyond listing it (`GET /sessions`, `GET /sessions/public`, league reads).
- **League table caching** or making the league-top read cheaper. The refresh is still one league table read per live session, and is rarer now because it only fires on ended-session changes.
- **Refreshing league tops when a session is closed.** Closing removes a session from memory but doesn't change its stored status or scores, so no league table changes.
- **The quiz controller and the Live edit save.** They already go through the Live edit service, which delivers its own outcomes.
- **Attributing who edited a bonus award** (see the "Grading isn't attributed" tradeoff in `CLAUDE.md`).

## Further Notes

- The new REST entry is the REST counterpart of the gateway: the gateway receives socket events and hands each outcome to delivery, and this module does the same for HTTP. It should stay as thin as the gateway's handlers. Rules belong in the change modules, and pushes belong in delivery.
- Because the league-tables-changed flag is computed in the commit step, the socket and timer paths gain the lobby refresh without any change to the gateway or the phase timers.
- The architecture review's "after" diagram names `sessionEnded` as a hook. This spec makes it a flag on the outcome instead, so that Previous from `ended` and score changes after the end are covered by the same rule.
