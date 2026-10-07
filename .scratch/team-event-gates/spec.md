# Spec: Team events check whether they're allowed inside their session write

Status: ready-for-agent

Blocked by: — (follows session-write and live-session-events, both done)

## Problem Statement

Every change to a live session already runs as one **session write**: one at a time per session, against the session as the previous write left it. But most team events do their most important work _before_ they join that queue:

- They check whether the event is allowed (is this question still answerable, does this socket own the team's seat, is the showdown still taking guesses, is the round open for rating) against the **stored** session, outside the write.
- They then write to the database (store the answer, store the guess, grade, award the bonus, remove the team from the roster, create the showdown round, store the rating), also outside the write.
- Only after that do they queue a write to update the session.

So a press can commit between the check and the database write. The worst case happens on quiz night at the busiest moment, the last seconds of a block:

- **A closest_guess answer can be lost to grading.** A team submits on the last question of a block while the quiz master presses Advance (or the locking timer runs out). The answer passes the "answering" check against the stored session. The press then commits the move into the break, which batch-grades the block's closest_guess questions. Only after that is the answer stored. It keeps no grade and 0 points, and nothing ever grades it again: the batch skips questions that already have a summary, and closest_guess is never **ungraded**, so the break doesn't wait for it and `/control` shows nothing to grade. The team's guess silently doesn't count.
- **An answer can be accepted after its question has locked.** Any question type: the answer lands in a block that has already moved on to the break, or after a kahoot question's speed scoring ran.
- **A showdown guess can be accepted after the reveal has started.** The guess check passes against the stored session, a reveal step commits, then the guess is stored and changes the showdown under the reveal.
- **A rating or a comment can be stored after its window closed.** Round ratings and the final form check the feedback window against the stored session outside any write. Their handlers hold these rules themselves instead of the Live session module.
- **A team event can be accepted from a socket that just lost the seat.** Leaving checks socket ownership outside the write, so a leave from an old socket can remove a team that has just reconnected on a new one.

These windows are milliseconds, but they are widest exactly when every team submits at once and the timer locks. The existing race tests only cover an answer racing an Advance to the _next question_, where nothing gets graded, so none of this shows up in CI.

## Solution

A team event's check, its database write and its session change happen as **one step inside its session write**. The event is checked against the session as the previous write left it, so the result is always one of two clean orders:

- **The team event was queued first.** It's checked, stored and reflected in the session; the press that follows sees it (the closest_guess batch grades it, the kahoot speed scoring scores it, the showdown resolve counts the guess).
- **The press was queued first.** The team event is checked against the session the press left, and it's refused with the same message the phone already shows when it's too late ("Answers are locked for this question", "This showdown round is no longer accepting guesses", …). Nothing is stored.

There is never a third outcome where the event was accepted but the press didn't see it. Nothing changes for the people in the room, except that a last-second answer either counts or is clearly refused, never silently scored 0.

## User Stories

1. As a team, I want a closest_guess answer submitted in the last second before the break to be graded with everyone else's, so that our guess counts.
2. As a team, I want an answer that arrives after the quiz master moved into the break to be clearly refused, so that we know it didn't count rather than seeing it as sent.
3. As a team, I want "Answers are locked for this question" to mean the answer was not stored, so that the phone and the scores never disagree.
4. As a quiz master, I want every answer stored for a closest_guess question to be graded once the break starts, so that I never reveal a block with a team's guess silently at 0.
5. As a quiz master, I want the break's ungraded markers to cover every answer stored for the block, so that "nothing left to grade" really means nothing.
6. As a quiz master, I want an answer to a kahoot question to be either speed-scored with the others or refused, so that no team gets points for an answer sent after the lock.
7. As a quiz master pressing Advance at the busiest moment, I want my press and the teams' last answers to land in a clear order, so that I don't have to think about timing.
8. As a quiz master, I want the locking timer running out to behave exactly like my own press here, so that an automatic lock is just as safe.
9. As a team in a showdown, I want our guess to be either part of the round or refused once the reveal starts, so that the reveal never changes under the big screen.
10. As a quiz master, I want the showdown resolve to see every accepted guess, so that the winner is decided on the guesses that were actually in.
11. As a team, I want a round rating sent just as the break ends to be either saved or refused, so that I'm not told it saved when it didn't count.
12. As a team, I want the final feedback form to be accepted only while it's open, checked the same way as everything else, so that a closed form never stores late feedback.
13. As a team that just reconnected on a new phone, I want a leave sent from our old socket not to remove us, so that a stale device can't drop us from the quiz.
14. As a team, I want a join and a kick for the same team to land in one order, so that we're either kicked or joined, never half of each.
15. As a quiz master, I want a grade I give to land against the session as it is, so that it never interleaves with a live answer-key fix or with leaving the break.
16. As a quiz master, I want a bonus award to be checked against the session's bonus settings at the moment it's stored, so that its limits hold.
17. As a quiz master, I want creating a showdown round to check for the tie against the current leaderboard, so that a round is only created for teams still tied.
18. As a quiz master, I want an event refused because it was too late to change nothing at all, neither the session nor the database, so that a refusal is always safe.
19. As a quiz master, I want a team event that fails on the database not to hold up the next press or answer, so that one hiccup doesn't stall the quiz.
20. As a team reconnecting after a refused answer, I want my resynced answers to match what the server stored, so that my phone never shows a ghost answer.
21. As a developer adding a new team event, I want one rule (check, write to the database and change the session inside one session write), so that I can't reintroduce this race by accident.
22. As a developer, I want the rules for whether a team event is allowed to live in the Live session module, not in socket handlers, so that every rule about the session has one home.
23. As a developer, I want the overlap of a team event and a press pinned by gateway tests in both orders, so that a regression shows up in CI, not on stage.

## Implementation Decisions

- **The rule:** a Live session event checks whether it's allowed, does every database write it makes, and changes the session, all inside the change it hands to the session write. The change receives the session as the previous write left it. Checks that used to read the stored session read that session instead. Database writes that used to run before the session write move inside it. Reads that build replies after the write (the join reply's saved answers, bonus awards, ratings and feedback) may stay outside.
- **Events that move their check and database write inside the session write:**
  - submit answer: the answering check and the seat-ownership check, then storing the answer, the answered-team list and the grading refresh;
  - submit showdown guess: the "still taking guesses" check and seat ownership, then storing the guess;
  - grade answer: grading the answer, then the grading refresh;
  - award bonus: reading the session's bonus settings, then storing the award;
  - team joined: resolving or creating the team, then the takeover rule (already inside), the connection and the roster;
  - team left: the seat-ownership check, then removing the team from the roster;
  - kick team: removing the team from the roster;
  - create showdown round: the tie check against the session's leaderboard, then creating the round.
- **Round ratings and the final form become Live session module events.** "Round rated" and "feedback sent" are new event methods. They check which team the socket belongs to, whether feedback is collected, and whether the round or final form is open, all inside a session write, then store the rating or feedback. Their socket handlers become plain dispatch like the others. They change no session state and don't touch scores, so they are declared as not touching scores and produce no broadcast. The getters that only those handlers used (team for a socket, whether feedback is collected, round open for rating, final form open) are removed if nothing else uses them.
- **A refusal is thrown before any database write**, so a refused event stores nothing. The messages stay the same, and so does the existing mapping from a refusal to the socket ack and error the phone already handles.
- **The session write's interface doesn't change.** It's still "run this change against the current session, read standings unless told not to, store it". Only what callers put inside the change moves. It stays non-re-entrant: an event's change must not call another public event method. Where one event delegates to another today (award bonus to bonus changed, grade answer and submit answer to the answer refresh, team left and kick to team removed), the shared step becomes a private change-building helper that both run inside their own single write.
- **Throughput:** answers for one session are now stored one at a time instead of overlapping on the database. At pub-quiz scale (tens of teams), a burst at the lock is a few dozen short writes queued per session. That's accepted, in the same spirit as the session-write spec's one standings read per write. Other sessions are unaffected.
- **No schema, protocol, payload or room-view changes.** Phones already handle every refusal message involved.
- **Docs, in the same change:**
  - `GLOSSARY.md`'s **Session write** entry gains "an event is checked against the session as the previous write left it, and stores nothing when refused".
  - `CODING_STANDARDS.md`'s game-state section gains the rule above for anyone adding an event.
  - `DOCUMENTATION.md`'s note on how events are applied one at a time gets the same sentence.
  - The `/guide` page is unchanged: nothing the quiz master sees or does changes.

## Testing Decisions

- **A good test asserts only what clients receive**: the acks and errors the sending socket gets, and the snapshots, answer lists and team syncs the admin, display and players rooms get, plus the stored answer or grade where that is the visible result (via the admin answer list). Don't assert queue order, call counts or which internal helper ran.
- **One seam: the real-store gateway harness** used by `session-write.spec.ts` and `commit-a-move.spec.ts`. Force the overlap with `holdNextCall` on a database call the first event makes (the press's progress save, or the answer store for the reverse order) and `nextWriteWaiting` to know the second event is queued. Each race is tested in **both orders**.
- **Cases:**
  - A closest_guess answer on the last question of a block, sent while the Advance into the break is held on its progress save, is refused with "Answers are locked for this question", and the admin answer list for that question doesn't contain it.
  - The same answer, sent first and held on its store while the Advance is pressed, is stored and then graded by the break's batch: the admin answer list shows it graded, and the reveal shows its points.
  - The same pair with the locking timer's expiry instead of a press.
  - A kahoot answer sent while the lock's press is held is refused; sent first, it's speed-scored like the others.
  - A showdown guess sent while the first reveal step is held is refused; sent first, it's counted by the resolve.
  - A round rating sent while the press out of the break is held is refused; sent first, it's saved (visible on the session stats).
  - A leave sent from a team's old socket after a takeover rejoin on a new socket is refused, and the team stays on the roster and connected.
  - A team event that fails on the database (the answer store rejects once), followed by a press: the press still commits.
- **Existing specs stay green unchanged.** In particular, `session-write.spec.ts`'s "keeps an answer submitted while an Advance waits on its progress save" still holds: the answer is queued behind the press and is still answerable after a move to the next question within the block. `rate-round.spec.ts` and `send-feedback.spec.ts` keep their refusal cases and now run through the Live session module.
- **Prior art:** `session-write.spec.ts` for overlap with `holdNextCall` and `nextWriteWaiting`; `closest-guess-reveal.spec.ts` for walking a closest_guess question into the break and reading its grades; `kahoot-answer-speed.spec.ts` for speed scores; `showdown-reveal.spec.ts` and `showdown-socket.spec.ts` for guesses; `join-players.spec.ts` for takeover rejoins.

## Out of Scope

- The live-edit save in the quiz editor (the frontier check and database save run outside the session write). It's the same kind of race but runs through the quiz controller and the gateway. It's candidate 3 of the 2026-10-07 architecture review and gets its own spec.
- Re-grading a closest_guess answer that is already stored without a grade. Once this spec lands, no new ones can be created, and sessions already played aren't revisited.
- Merging bursts of answers into fewer standings reads or batching answer stores. One standings read per write stays; revisit only if profiling shows the queue lagging at the lock.
- Inlining the remaining pass-through socket handlers or moving timer re-arming into the session outcome (review candidate 9).
- Serialising across backend instances. One instance is a stated constraint.

## Further Notes

- Source: candidate 1 ("Team events check their gate inside the Session write") of the architecture review dated 2026-10-07.
- The session-write spec said "every public event method of the Live session module goes through it". That holds for the session change, but the checks and database writes were left in front of it. This spec finishes that job; it doesn't change the session write itself.
- The closest_guess loss is reasoned from the code (the answering check reads the stored session before the answer store, and the break's batch skips questions it has already summarised). No test reproduces it yet. The first ticket should write the failing race test before moving any code.
- Suggested order: (1) the failing closest_guess race test, then submit answer inside the write; (2) showdown guess and create showdown round; (3) grade answer and award bonus; (4) join, leave and kick; (5) round rated and feedback sent as Live session module events, handlers reduced to dispatch; (6) docs. Each step leaves the suite green.
