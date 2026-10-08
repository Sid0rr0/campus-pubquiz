# Spec: Live session events are built by per-domain change modules

Status: ready-for-agent

Blocked by: session-write-module

Source: architecture review 2026-10-08, candidate 2. Builds on candidate 1 ([session-write-module](../session-write-module/spec.md)). Candidate 3 (moving the quiz-edit cluster into the Live edit module) is a separate spec and is left out of this one.

## Problem Statement

Once the Session write has its own module, the game state class (the Live session module's main file) still holds every live session event's body. Six unrelated domains sit in one file of roughly 1,000 lines:

- team roster: join, disconnect, leave, kick
- answers and grading: submit, grade
- bonus awards: award, bonus changed
- team feedback: round rated, feedback sent
- showdowns: guess, new round
- session settings: break end time, display text size, lobby settings

This causes friction for anyone changing an event:

- **The rule against nested writes is enforced only by a comment.** `CODING_STANDARDS.md` says that a shared step (the answer refresh, a team's removal, a bonus change) builds a change and is never a write of its own: a write must not call another public event method. Every event body sits in the class that owns the public event methods and the Session write module. An author can call `kickTeam` from inside another event's change, or call the write from inside a shared step, and nothing but review catches it. Doing so either deadlocks the session's queue or reads the session twice in one write.
- **No locality per domain.** Changing how a showdown guess is checked means scrolling past joins, bonuses and feedback. The shared steps sit far from the events that use them: the answer refresh is ~200 lines below `submitAnswer`, and the team-removal change is below `kickTeam`.
- **Each domain's checks are hard to find as a set.** Each event checks its refusals in a set order before any database write: seat ownership, question still answerable, feedback open, a showdown still accepting guesses, lobby-only. That order is what makes "a refused event stores nothing" true, and it's spread through one long file.
- **The file is still too long** to load whole for an agent or to review as one piece.

## Solution

Each domain's checks, database writes and session changes move into a **change module** for that domain:

- team roster
- answers
- bonus awards
- team feedback
- showdowns
- session settings

A change module builds changes: given the session as the previous write left it, plus the event's input, it refuses or returns the new session and its outcome. It has no reference to the Session write module or to the game state class. So it can't run a write, can't call another event, and can't store a session. The nested-write rule becomes a property of the structure.

The game state class becomes a façade. Each public event method hands one change module's change to the Session write module, with that event's "doesn't touch scores" option where it applies, and returns the outcome. Its public interface is unchanged, so the gateway, the controllers, the Live edit module and the import module need no edits.

Nothing changes in the room. Every refusal, its wording, every push and its order stay the same.

## User Stories

1. As a backend developer, I want each domain's events in their own change module, so that I can change showdowns without reading joins, bonuses and feedback.
2. As a backend developer, I want a change module to have no way to run a write, so that a nested session write can't be written by mistake.
3. As a backend developer, I want a change module to have no way to call another event, so that one event's change can't re-enter the session's queue.
4. As a backend developer, I want a change module to have no way to store a session, so that the Session write module stays the only place a session is stored.
5. As a backend developer, I want each shared step next to the events that use it, so that the answer refresh sits with submit and grade, and a team's removal sits with leave and kick.
6. As a backend developer, I want each event's refusals checked in the same order as today, before any database write, so that a refused event still stores nothing.
7. As a backend developer, I want every refusal message to stay word for word, so that phones and `/control` show the same text.
8. As a backend developer, I want the game state class to read as a list of events, each one write call long, so that I can see at a glance which events touch scores.
9. As a backend developer, I want the "doesn't touch scores" option declared next to the write call for each event, so that skipping the standings read is visible where the write happens.
10. As a backend developer, I want the team roster change module to own the join's seat takeover rule, so that "a live socket already holding the seat refuses the join unless the request names it" lives in one place.
11. As a backend developer, I want the join reply (saved answers, bonus awards, round ratings, feedback) built by the team roster change module, so that everything a join sends back is in one module.
12. As a backend developer, I want the join's "any failure becomes a refusal" wrapping kept exactly as it is, so that a team sees "Unable to join" or the service's own message as today.
13. As a backend developer, I want a team's removal built once for both leave and kick, so that a kick's TEAM_KICKED notice and socket close stay the only difference.
14. As a backend developer, I want a disconnect from a socket that held no team to still produce nothing to push, so that stray sockets don't cause broadcasts.
15. As a backend developer, I want the answers change module to own the answer refresh, so that a submitted answer and a graded answer refresh the answered teams, the grading refresh and the admin answer list the same way.
16. As a backend developer, I want the kahoot response time still measured from the phase start inside the answer's write, so that speed scoring is unchanged.
17. As a backend developer, I want a grading error from the answer service still turned into a refusal, so that an unknown answer or a closest-guess answer is refused as today.
18. As a backend developer, I want the bonus awards change module to own the bonus change, so that awarding and a bonus changed from REST refresh the leaderboard the same way, and only a fresh award carries BONUS_AWARDED.
19. As a backend developer, I want an invalid bonus award still turned into a refusal carrying the bonus service's message, so that the quiz master sees why it was refused.
20. As a backend developer, I want the team feedback change module to keep its shared rules (team required, feedback collected, form open), so that a rating or comment sent as the break ends is either stored or refused, never stored late.
21. As a backend developer, I want the showdowns change module to own the "invalid showdown becomes a refusal" translation, so that both showdown events refuse the same way.
22. As a backend developer, I want a new showdown round still created only for teams tied for first, read from the session the write holds, so that a stale tie never starts a round.
23. As a backend developer, I want the session settings change module to keep lobby settings lobby-only, so that settings stop moving once the quiz starts.
24. As a backend developer, I want the break end time and display text size changes in the session settings change module, so that every admin-set session value is in one place.
25. As a backend developer, I want presses to keep going straight to the Move committer, so that Commit a move stays the single way a press is carried out.
26. As a backend developer, I want the quiz-edit step left where it is for now, so that this spec doesn't overlap the Live edit spec that will move it.
27. As a backend developer, I want the change modules composed inside the game state class like the Move committer, so that the Nest DI graph doesn't change.
28. As a backend developer, I want each change module to take only the services its domain uses, so that a module's dependencies tell me what it touches in the database.
29. As a backend developer, I want the existing gateway specs to pass unchanged, so that I know nothing in the room moved.
30. As a backend developer, I want `CODING_STANDARDS.md` to say that a change module builds a change and never holds the write, so that reviewers check for the structure, not the comment.
31. As an AI agent working in this repo, I want each change module under ~250 lines and the façade under ~400, so that I can load the domain I'm changing whole.
32. As a quiz master, I want joins, grading, bonuses, kicks, showdowns and settings to behave exactly as before, so that the refactor is invisible on quiz night.
33. As a team on a phone, I want answering, joining, leaving, rating rounds and sending feedback to be accepted or refused exactly as before, so that playing doesn't change.
34. As a viewer of the big screen, I want the leaderboard, answered markers and connection dots to update exactly as before, so that the show isn't affected.

## Implementation Decisions

- **Six change modules, one per domain:** team roster, answers, bonus awards, team feedback, showdowns, session settings. Each is a plain class composed inside the game state class, like the Move committer and block grading. None is a Nest provider.
- **A change module's interface is change builders.** Each event gets a method that takes the session as the previous write left it plus the event's input, and returns either a refusal (thrown) or the new session with its outcome. That is exactly the shape the Session write module's `write` takes.
  - The team roster module also exposes the join reply builder. It is used after the join's write, as today.
  - The answers module's shared answer refresh is private to that module.
  - The bonus awards module's shared bonus change is private to that module.
  - The team roster module's shared team-removal change is private to that module.
- **Constructor dependencies per module, and nothing else:**
  - Team roster: team service, answer service, bonus service, feedback service. The last three are for the join reply.
  - Answers: answer service and block grading.
  - Bonus awards: bonus service.
  - Team feedback: feedback service.
  - Showdowns: showdown service.
  - Session settings: seed service, for persisting lobby settings.
  - No module receives the Session write module, the store or the game state class.
- **Inputs a change module can't know come in as arguments, never as dependencies:**
  - the sender's socket id
  - the socket layer's "is this socket live" check, for the join's seat takeover
  - the clock reading for kahoot response time: read inside the change as today, so the measured time stays inside the write
- **The game state class becomes a façade.** Each public event method is one `write` call to the Session write module, passing the relevant change module's builder. The "doesn't touch scores" option is passed at that call, for the same events as today:
  - disconnect
  - round rating and feedback
  - break end time and display text size
  - showdown guess and new round
  - lobby settings
- **What the façade still owns:**
  - The join's post-write reply assembly and its "any failure becomes a refusal" wrapping.
  - The press, which goes to the Move committer.
  - Session lifecycle: create, close, restart restore.
  - The getters.
  - The quiz-edit step and the quiz hold, until the Live edit spec moves them.
- **Outcome constants:**
  - The broadcast outcome stays with the SessionOutcome type.
  - The nothing-to-push outcome, used only by team feedback, moves into the team feedback module.
  - The "doesn't touch scores" option constant stays with the façade.
- **Domain error translation moves with its domain:**
  - Invalid showdown errors become refusals in the showdowns module.
  - Invalid bonus award errors become refusals in the bonus awards module.
  - Answer-service grading errors become refusals in the answers module.
- **Wording and order are part of the contract.** Every refusal message and every check's position relative to the database writes stays exactly as it is.
- **`CODING_STANDARDS.md`'s Live session rule is reworded:** a shared step lives in its domain's change module, and a change module never holds the Session write module or the game state class. The rule stays in place, but it now describes the structure instead of asking authors to remember it. No glossary change: "change module" is a code-structure word, not a domain term.
- **No schema, protocol, socket payload or REST change.**

## Testing Decisions

- **One seam: the gateway, driven through the real-store harness**, as in the session-write-module spec. This was agreed with the user over unit-testing each change module against a session value. The refactor preserves behaviour, so it's verified by every existing gateway spec passing unchanged.
- **A good test here** sends a socket event or a controller call through the gateway and asserts what rooms and sockets receive: snapshots, replies, notices, sockets closed, refusals and their wording. It never imports a change module.
- **Specs that cover each domain and must pass without edits:**
  - Team roster: join-players, join-leave-kick-order, team-removed, team-presence, team-connection-presence, disconnect-user.
  - Answers: submit-answer, answer-recorded-and-graded, grading, grading-gate, kahoot-answer-speed, last-second-answer, roster-answer-grading-isolation.
  - Bonus awards: award-bonus, bonus-changed, grade-and-bonus-write.
  - Team feedback: rate-round, send-feedback, feedback-write-gates, collect-feedback-setting.
  - Showdowns: showdown-socket, showdown-write, showdown-reveal.
  - Session settings: set-break-end-time, set-display-text-scale, update-session-settings, session-creation-defaults.
  - Across all domains: session-write, socket-event-authorization, remaining-events, and the rest of the game gateway specs.
- **No new specs.** Each change module's behaviour is already covered through the gateway. A gap found while moving code is added as a gateway-level spec, not as a change-module spec.
- **Prior art:** the session-write spec's hold-next-call pattern, for any ordering check that's needed.
- **Done when:**
  - `pnpm --filter backend test`, `pnpm typecheck` and `pnpm lint` pass.
  - The façade is under ~400 lines.
  - No change module imports the Session write module or the game state class.

## Out of Scope

- Moving the quiz-edit step, the quiz hold, the live-session list and the live-edit frontier into the Live edit module (candidate 3).
- Changing the press path or the Move committer.
- Splitting the getters out of the façade, or deleting the two deadline getters only tests call.
- Making any change module a Nest provider or injecting it elsewhere. That includes letting the gateway call change modules directly.
- Lint rules that enforce the import restriction. The structure and review cover it. A lint rule can come later if a violation shows up.
- Any behaviour change, including refusal wording and log text.

## Further Notes

- The spec is blocked by session-write-module because change modules are built against its `write` interface. Doing this split before it would move the store and commit along with the events and then move them again.
- Ticket order suggestion for `/to-tickets`: one ticket per domain, each moving that domain's events and shared step, each landing green on its own. Start with the smallest domain (session settings or team feedback) to set the pattern. Finish with a ticket that rewords `CODING_STANDARDS.md` and checks the façade size and import restrictions.
- `DOCUMENTATION.md`, `GLOSSARY.md` and the `/guide` page need no change.
