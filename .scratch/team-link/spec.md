# Spec: A Team link module for the phone's join and rejoin lifecycle

Status: done

Blocked by: none. It doesn't need `socket-protocol`, but if that lands first the hook adapter uses its typed socket and emit helper.

Source: architecture review 2026-10-07, candidate 5 ("A Team link module for the phone's join and rejoin lifecycle").

## Problem Statement

A team's phone has to stay linked to its team through everything a quiz night throws at it: the first join, a phone waking from sleep, a network switch, the quiz master restarting the session, a kick, the session closing, and logging out. While it's linked, an answer the team sent just before the connection dropped must still reach the server.

Today nothing owns that lifecycle as one thing. It's coordinated by timestamps, refs and effects spread over two hooks and a page:

- **Three places send `JOIN_PLAYERS`.**
  - The join hook sends it once per connection: deduplicated against the connection's `reconnectedAt` timestamp, guarded against a double tap by a ref, and re-sent on a form retry by bumping an attempt counter.
  - The `/play` page infers a session restart by watching the status go back to `lobby`, and sends its own join. That join skips the double-tap guard, the once-per-connection dedupe and the typed team code.
  - The player hook builds the join payload, including the earlier socket id the server uses to hand the team over from a stale socket.
- **The pending answer lives in refs.** The player hook keeps the last unacknowledged answer, an attempt counter and a confirmation timer in refs. It resends the answer after the next join is accepted, through a ref that an effect keeps current, because the socket bindings and the send depend on each other.
- **The team's own data is rebuilt in setters.** Join accepted replaces the team's answers, grades, bonus awards, ratings and feedback. Answer received merges one answer. Team answers synced replaces the answers and grades. Bonus awarded appends. Each listener does its own merge or replace inline.
- **Kick, session close and logout each reset a slightly different subset by hand.** Kick clears everything, including the stored team name and team code. Session close and logout keep the name and team code so the form stays prefilled. Each also clears the double-tap guard. Kick runs its reset in an effect so it still applies when a component mounts already kicked. Session close uses a render-time adjustment.

The rules are there, but they live in comments explaining why an effect has the dependencies it has. The orderings where bugs would hide (a join and a reconnect landing together, a restart while a join is in flight, a kick during a rejoin, an answer acknowledgement arriving after a reconnect) are hard to test:

- All 18 `/play` and join-panel test files mock the whole player hook, so they never see real event ordering.
- The one test that drives the real hooks on a fake socket fails about one run in five under load, which several finished tickets have noted. It depends on effect timing, not on events.

## Solution

The lifecycle moves into one **Team link** module: plain TypeScript, no React, no socket. Events (what the server sent, what the connection did) and intents (what the team did) go in. The new link state and a list of commands (send a join, send an answer, force a reconnect, leave, write or clear stored identity, go back to the join screen, show a toast) come out.

A thin hook adapter runs the module with React: it feeds the socket's events and the team's taps in, keeps the state, and carries out the commands against the socket, `localStorage`, the router and the toaster. `/play` and the home page's join panel read the same things from it as today.

For the team, nothing changes on screen, except that the edge cases behave the same way every time:

- one join per connection, even when the team taps twice;
- a restart rejoins through the same path as every other join, with the same guard and the team code they typed;
- a kick, session close or logout leaves the phone in a known state whatever it was doing at the time;
- an answer sent just before the connection died is resent once the phone is linked again, and only then.

## User Stories

1. As a team joining for the first time, I want exactly one join sent when I tap Join, so that a brand-new team name isn't refused as "already registered" by our own second request.
2. As a team tapping Join twice in quick succession, I want the second tap ignored until the first is answered, so that we don't race ourselves.
3. As a team whose join was refused, I want the reason shown on the join screen and the next tap to try again, so that I can fix the name or team code and retry.
4. As a team retrying with only the team code corrected, I want the retry to send a fresh join over a fresh connection, so that a refused connection that won't reconnect on its own doesn't swallow the retry.
5. As a team whose join was refused, I want the old error cleared once a later join is accepted, so that the banner never sits over a working game.
6. As a team whose connection was refused (an unknown game code), I want the error shown and my next tap let through, so that I'm not stuck behind a guard that no answer will ever release.
7. As a team whose phone woke from sleep, I want it to rejoin our team on the new connection automatically, so that we can keep answering without reloading.
8. As a team whose phone switched networks, I want the rejoin to hand our team over from the old connection, so that the server doesn't refuse us as a second device.
9. As a team rejoining on the same connection, I want no handover named, so that the server isn't asked to take the team from ourselves.
10. As a team that sent an answer just as the connection dropped, I want it resent once we're linked again, so that our answer still counts.
11. As a team whose answer got no acknowledgement within a few seconds, I want the phone to treat the connection as dead and reconnect, so that a silently broken socket doesn't eat our answers until the ping timeout.
12. As a team whose answer was refused by the server ("Answers are locked for this question"), I want the refusal shown and the answer not resent, so that a refusal never looks like a connection problem.
13. As a team sending a second answer before the first was acknowledged, I want only the latest answer kept pending, so that an older answer never overwrites a newer one.
14. As a team, I want an acknowledgement for an earlier, superseded send to be ignored, so that it can't clear the newer pending answer.
15. As a team trying to answer while not linked, I want a "not connected" message straight away, so that I know to wait for the reconnect.
16. As a team whose phone was open when the quiz master restarted the session, I want the phone to rejoin under the restarted session through the normal join, so that we're registered again without doing anything.
17. As a team refreshing the page while the session is in the lobby, I want only one join sent, so that a refresh isn't bounced as "already connected".
18. As a team kicked by the quiz master, I want to land on the join screen with the notice "You were removed from this team by the quiz master" and an empty form, so that we have to join again on purpose.
19. As a team that was kicked and then reloaded the page, I want the phone not to rejoin silently, so that the kick holds.
20. As a team whose session the quiz master closed, I want to return to a fresh join screen with our team name and team code still filled in, so that we can join the next game as the same team.
21. As a team logging out, I want the server told we're leaving while we're still connected, and our name and team code kept in the form, so that we don't linger on `/control` and can play again another night.
22. As a team logging out with no confirmed team yet, I want no leave sent, so that a half-joined phone doesn't send a leave for nobody.
23. As a team arriving from a QR code for a specific game or team, I want the URL's game code, team code and name to win over what this phone stored last time, so that a fresh scan joins the right team.
24. As a team returning on the same phone, I want the stored team name, game code and team code to prefill the form and reconnect automatically, so that we don't retype anything.
25. As a team whose stored team name survived a closed session but whose game code didn't, I want to see the join form, not a "Connecting…" screen that never ends.
26. As a team joining without typing a team code, I want the team code the server assigned to show up in the form, so that it's there if we log out and come back.
27. As a team, I want our saved answers, grades, bonus awards, round ratings and feedback restored whenever a join is accepted, so that a reconnecting phone shows exactly what the server has.
28. As a team, I want an answer the server confirmed to update just that answer (and its grade, when it's graded automatically), so that the rest of our history stays put.
29. As a team whose block reached the reveal, I want our answers and grades replaced with the freshly graded set, so that the phone matches the scores.
30. As a team receiving a bonus award live, I want it added to our awards and toasted, so that we notice it; awards restored on join aren't toasted again.
31. As a team, I want a round rating or feedback the server acknowledged to stay shown after a reconnect, and a tap that never reached the server not to, so that the stars on screen are the ones that count.
32. As a team on a new connection, I want the previous connection's team data cleared until the new join answers, so that a different identity's data never lingers on screen.
33. As a developer, I want one module to be the only place that decides when to send a join, so that a new trigger can't reintroduce a double join.
34. As a developer, I want to test the lifecycle as a sequence of events with no React, no timers and no socket, so that ordering bugs show up as deterministic test failures, not flakes.
35. As a developer, I want the `/play` page to stop inferring restarts itself, so that the page only renders.
36. As a developer, I want the storage rules (what kick, session close and logout each keep) in one place, so that they can't drift between the three paths.
37. As a developer, I want the hook adapter thin enough that a handful of fake-socket tests cover it, so that most coverage sits on the module.

## Implementation Decisions

- **A new Team link module in the frontend**, plain TypeScript with no React, socket or browser imports. Its interface is a reducer plus an initial state:
  - `initialTeamLink(entry)` takes what the phone arrived with: the URL's game code, team code and name, and the stored identity (team name, team token, team code, game code) that the adapter read from `localStorage`. It applies the existing precedence (the URL wins over storage; storage fills only what the URL left empty).
  - `teamLink(state, input) → { state, commands }`, where `input` is an event or an intent.
- **Events in:**
  - the connection: connected (with its socket id and a connection counter), disconnected, connection refused (with the reason);
  - joins: join accepted (the join payload), join refused (the reason);
  - room state: the players view arrived (only its status is read, to spot a restart);
  - team updates: answer received, team answers synced, bonus awarded, kicked, session closed;
  - answer sends: answer acknowledged, refused or not delivered (each with the attempt it belongs to), answer confirmation timed out (with its attempt);
  - feedback: round rating saved, feedback saved.
- **Intents in:** typing in the name, game code or team code field; submitting the join form; submitting an answer; logging out.
- **Commands out:**
  - open a connection for a game code and attempt, close it, force a reconnect;
  - send a join (the payload, including the earlier socket id when it differs from the current one);
  - send an answer (the payload and its attempt), arm or clear the answer confirmation timer for an attempt;
  - send a leave;
  - write the stored identity, clear the session part of it, clear all of it;
  - go to the join screen;
  - toast an error or a bonus award.

  The adapter carries each one out and feeds any result back in as an event.
- **The state** holds:
  - the identity: team name, game code, team token and team code;
  - the form fields;
  - the link phase: not connected, connecting, joining, linked, kicked or closed. `isTeamLinked` is "linked";
  - whether a join is in flight, and which connection a join was already sent for;
  - the socket id the team was last linked on;
  - the pending answer and its attempt;
  - the join error;
  - the last status seen on this connection;
  - the team's own data: the join payload, answers, grades, bonus awards, round ratings, feedback and the ratings epoch.
- **One join sender.** Only the module emits a "send a join" command. It sends one for a connection once the identity and the connection are both known, again after a form submit (which also opens a fresh connection, as the attempt counter does today), and again when the status moves into `lobby` from another status on the same connection (a session restart). It never sends one while a join is in flight. Every join uses the same payload rule: the stored team token, the typed team code (else the stored one), the game code and the handover socket id. The `/play` page's own restart join is removed.
- **The pending answer.** Submitting while linked sends the answer and arms the confirmation timer for that attempt.
  - A later submit supersedes it.
  - A "not delivered" result keeps it pending without forcing a reconnect.
  - A timeout unlinks the phone and forces a reconnect.
  - An acknowledgement clears it. A refusal also toasts.
  - Results for older attempts are ignored.
  - Join accepted resends the pending answer.
  - Submitting while not linked toasts "not connected" and sends nothing.

  These are the behaviours today's player-hook tests pin, moved into the module.
- **The team's data rules live in the module:**
  - join accepted replaces everything and bumps the ratings epoch;
  - answer received merges one answer, and its grade when it was graded;
  - team answers synced replaces answers and grades;
  - bonus awarded appends and toasts;
  - a saved rating or feedback updates its entry;
  - a new connection identity clears the team data.
- **One rule for leaving a session**, used by kick, session close and logout:
  - **Kick:** clear all stored identity, empty the form, set the kick notice, go to the join screen. It's also correct when the module starts already kicked.
  - **Session close:** clear the session part of storage (token and game code), keep the name and team code, go to the join screen.
  - **Logout:** send a leave if there's a confirmed team, clear the session part of storage, keep the name and team code, reset the game code to the URL's.

  All three release the join guard and clear the join error.
- **The hook adapter** replaces today's join hook and player hook for `/play` and the home page's join panel.
  - It sits on the existing connection core, reads `localStorage` once after mount (the SSR-safe pattern used today), dispatches socket events and taps into the module, and executes commands.
  - It runs the answer confirmation timer with the existing constant.
  - Its result keeps today's shape for the pages (snapshot, connection error, team, `isTeamLinked`, the team's data, the form fields and setters, `activeJoinCode`, `hasStoredIdentity`, the action functions, `handleJoin`, `handleLogOut`), minus the raw join function the page used for restarts.
  - The banner's error stays "join error, else kick notice, else connection error".
- **Seen questions stay outside the module.** The seen-questions merge is already a pure helper fed by room state. The adapter keeps calling it, because it isn't part of the link lifecycle.
- **The rules page keeps a snapshot-only players connection** on the connection core, with no Team link, because it never joins a team.
- **Storage keys, the storage helpers' clear rules, the socket events, the payloads and the server are unchanged.** This is frontend-only, with no backend, protocol or schema change.
- **Docs, in the same change:**
  - `GLOSSARY.md` gains **Team link**: a phone's link to its team in a live session (who the team is, whether the server has this connection registered as the team's, and the team's own answers, grades, bonus awards and ratings). It's made by a join, remade after every reconnect and after a session restart, and ended by a kick, the session closing or logging out.
  - `docs/architecture.md`'s frontend diagram replaces the join hook and player hook with the Team link module and its adapter.
  - `DOCUMENTATION.md` needs no change: the behaviour it describes for `/play` is unchanged.

## Testing Decisions

- **Seams (agreed with the user):** the Team link module is the main seam. A few fake-socket tests cover the hook adapter. `/play` page tests keep mocking the hook.
- **A good test feeds events and intents into the module and checks the resulting state and commands**, never its internal fields' layout. Tests read like the quiz-night story: "a join and the connection's connect arrive together → one join command"; "answer submitted, connection drops, reconnects, join accepted → the answer is resent once"; "kicked while a join is in flight → storage cleared, no further join". No React, no timers, no socket: timeouts are events.
- **Module tests cover every user story above that's about ordering or state:**
  - the double tap;
  - refused join and retry, and refused connection;
  - reconnect rejoin, with and without a handover;
  - restart into `lobby`, versus a refresh landing on `lobby`;
  - the pending answer's supersede, not delivered, timeout, refusal, stale acknowledgement and resend after join;
  - kick (live, and starting kicked);
  - session close and logout, with and without a team;
  - the URL-versus-storage precedence;
  - the assigned team code mirrored into the form;
  - the data merge and replace rules;
  - the identity reset.

  Prior art for event-sequence tests over a pure state function is the shared types state machine tests (the game state transition and status group tests) and the seen-questions merge tests.
- **Adapter tests on the fake socket** (prior art: the existing player-hook tests and the join tests on the real player hook) shrink to what only the adapter does:
  - socket events reach the module;
  - commands become the right emits, storage writes and navigation;
  - the confirmation timer fires a timeout event;
  - one end-to-end join, connect and accept.

  Today's join-on-real-socket test, flaky about one run in five, is replaced by these and by module tests. The double-join case it covers becomes a module test.
- **`/play` page tests** (the join-and-reconnect, logout-and-errors and other `/play` and join-panel files) switch their mock from the player hook to the adapter, with the same result shape, and keep their rendering assertions. Assertions that tested lifecycle ordering through the page (rejoin on reconnect, restart rejoin, no double join on refresh) move to module tests. Those that check what the page renders for a given result stay.
- The frontend suite must be green with no flakes on repeated runs of the replaced tests (run the adapter and module test files several times in a row).

## Out of Scope

- Changing what the server does on join, takeover, kick, session close or leave.
- The admin's "re-link phone to team" escape hatch named in the accepted tradeoffs.
- Moving seen questions, the browsed question or the auto-advance setting into the module.
- Typing the socket protocol (`socket-protocol` spec). The adapter uses whatever emit and listener types exist when it lands.
- The `/display` and admin hooks.
- Replacing `localStorage` as the identity store.

## Further Notes

- The phone's restart rejoin today goes through the join hook's error handling but skips its double-tap guard, its once-per-connection dedupe and the typed team code. Moving it into the module's single join path closes that gap without a separate fix.
- The flaky join-on-real-socket test has shown up in at least four finished tickets' notes. Retiring it is a side benefit worth calling out in the PR.
- A natural ticket order:
  1. the module with its tests, covering joins and the leave rules;
  2. the pending answer and the team's data rules;
  3. the adapter swapped in for `/play` and the join panel, with the page's restart join removed and the old hooks deleted;
  4. docs.

  The first two can land without touching any page.
