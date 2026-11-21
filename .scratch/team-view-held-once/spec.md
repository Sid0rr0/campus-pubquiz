# Spec: The phone holds the team view as it arrives

Status: ready-for-agent

Source: architecture review 2026-11-21, candidate 1 ("The phone holds the Team view as received"). It finishes what [team-view-projection](../team-view-projection/spec.md) started on the phone.

## Problem Statement

Since team-view-projection, the server sends each team's phones one **team view** on join and on every change to that team. The phone, though, still keeps that data the way it did before:

- **Two copies.** Each team view is stored as it arrives (inside the join reply the phone holds, where the coins are read from), and it's also copied into a dozen separate team fields (answers, bonus awards, round ratings, feedback, session ratings, player count, joker, doubled rounds, joker extras, side, purchases, Ask the room readiness). Each copy has its own empty value and its own reset, and nothing checks that the two agree.
- **Patches from before team views.** After a successful round rating, feedback send, session rating, player count change or joker pick, the phone writes the value into its own state. The answer-received reply does the same for an answer. The server already sends a team view after a joker pick, a player count change and an answer submit, so those patches repeat the team view. Feedback writes send no team view at all, so a team's other phone never learns about a rating or comment until it reconnects.
- **A counter that runs too often.** The round rating card, and the star and scale rows on the final feedback form, only read the saved ratings once, when they mount. To pick up ratings from a join, they're re-mounted whenever a counter changes. The counter is meant to change only on a join or reconnect, but it now changes on **every** team view. During a break, a grade, a bonus award, a live edit or another team's answer (with Ask the room offered) re-mounts the rating card. A tap still waiting for its acknowledgement then loses its "Saving…/Saved ✓", and the row shows the old saved value. This was found by reading the code, not by reproducing it, and no test covers a team view arriving mid-rating.

For a team this shows up as a rating that seems to vanish, or as two phones of the same team disagreeing about the feedback form. For a developer, every new team field still has to be added to the phone in three places.

## Solution

The phone keeps exactly one copy of its team data: the last team view the server sent. The join reply's team view and every live team view replace it wholesale. Everything the play screens read about the team comes from it.

The server sends a team view after every feedback write too, so every team change reaches all of the team's phones the same way. Once that's true, the phone's own patches and the answer-received reply have nothing left to do, so they go.

The rating rows stop relying on a re-mount. Like the feedback comment box already does, they take the server's value for any row that isn't waiting on a tap of its own. The counter goes.

For the teams nothing looks different, except that ratings no longer vanish mid-break and a team's phones agree about their feedback.

## User Stories

1. As a team, I want the round rating I just tapped to stay on screen when an unrelated update arrives during the break, so that I'm not left wondering whether it saved.
2. As a team, I want "Saving…" to turn into "Saved ✓" on the row I tapped even if a grade or bonus award arrives in between, so that the confirmation is trustworthy.
3. As a team, I want a failed rating to keep showing "Not saved — tap to retry" when an unrelated update arrives, so that I know to tap again.
4. As a team, I want the pacing and felt-difficulty rows on the final form to behave the same way, so that a late result doesn't wipe my tap.
5. As a team, I want the round star rows on the final form to behave the same way, so that rating the night at the end is reliable.
6. As a team with two phones, I want a round rating made on one phone to show on the other, so that we don't rate a round twice or think it's still unrated.
7. As a team with two phones, I want a pacing or felt-difficulty answer made on one phone to show on the other, so that both phones agree.
8. As a team with two phones, I want a feedback comment and topic suggestions sent from one phone to show on the other, so that we don't send them twice.
9. As a team typing a comment, I don't want a comment sent from our other phone to overwrite text I haven't sent yet, so that my draft isn't lost (as today).
10. As a team, I want a row I'm tapping on one phone not to be overwritten by an older value from the other phone while my tap is waiting, so that the last tap wins.
11. As a team whose phone reconnects during the break, I want the rating card to show what the server holds, so that I carry on where we left off.
12. As a team whose phone reconnects during the break, I don't want a tap from the old connection that never got an answer shown as saved, so that I'm not misled (as today).
13. As a team, I want our answer to show as saved after I submit it, so that I know the quiz master has it.
14. As a team, I want a revised answer to replace our earlier one on screen once the server has it, so that I see what will be marked.
15. As a team, I want my pending answer to survive a team view arriving before the server acknowledges it, so that a slow network doesn't lose it (as today).
16. As a team, I want our player count to show the number I just set, so that I know it saved.
17. As a team, I want the joker I picked to show as soon as the pick saves, so that I know which round counts double.
18. As a team, I want the "the server drew your joker" and "your joker was moved" notices to keep appearing, and not to fire for a joker I picked myself, so that the notices stay meaningful (as today).
19. As a team, I want my coins, carried coin, purchases, doubled rounds, side and bonus awards to show what the server last said, so that nothing on my phone is out of date.
20. As a team, I want toasts, sounds and verdict cards not to fire just because a team view arrived, so that updates don't replay the night (as today).
21. As a team, I want a team view never to reach another team's phones, and the feedback team views to follow that rule too, so that our ratings and comments stay private.
22. As a quiz master, I want nothing to change on `/control`, `/display` or `/remote`, so that running the night is the same.
23. As a developer adding a team-level field, I want to add it to the team view and read it on the phone with nothing else to wire, so that I can't forget a copy.
24. As a developer, I want one place on the phone that holds team data, so that there's no second copy to keep in sync.
25. As a developer, I want the "live equals resync" property to cover feedback writes, so that a missed feedback team view is caught by the same check as every other change.
26. As a developer, I want acknowledgements to only report success or failure, so that the reducer has no special cases for "just saved".
27. As a developer, I want the rating rows not to need a re-mount key, so that a parent can't accidentally reset them.
28. As a developer, I want the socket protocol not to have an event that repeats what the team view already carries, so that the protocol stays small.

## Implementation Decisions

### The phone's team link holds one team view

- The team-link reducer's state keeps the team's identity and its **team view** as the join reply delivered them. A received team view replaces the held one. There are no other copies of team data.
- The separate team fields (answers, bonus awards, round ratings, feedback, session ratings, player count, joker, doubled rounds, joker extras, side, purchases, Ask the room readiness), their empty values, and the mapping that copied a team view into them are deleted.
- The shapes the play screens use (answers keyed by question id, round ratings keyed by round id) are worked out from the held team view where the hook exposes them, not stored. Keeping the hook's current names for those values is preferred, so the play screens don't change. A screen that already reads the team view directly (coins, carried coin) carries on doing so.
- Clearing the team (kick, code change) drops the held team view. The pending answer and its attempt counter are not team data. They stay outside the team view and survive a replace, following today's rules.
- The joker notices keep working by comparing the joker in the held team view with the one in the incoming team view, as they compare the separate field today.

### Acknowledgements report, they don't write

- The round rating, feedback, session rating, player count and joker pick acknowledgements return their result to the caller and dispatch nothing. Their five reducer actions are deleted.
- The **answer-received** reply is removed from the socket protocol: its event, its payload type, its reply case on the server, its listener and its reducer action on the phone. The server already lists the submitting team as changed on every answer submit, and the team view goes out right after the replies, so the saved answer reaches every phone of the team, including the one that submitted it. The submit acknowledgement still settles the pending answer, as today.

### Feedback writes send a team view

- The team feedback change module (round rating, feedback, session rating) lists the rating team as changed instead of reporting nothing to send. The delivery step then sends that team's phones a fresh team view, like every other team change.
- The team view already carries round ratings, feedback and session ratings, so nothing changes in the projection.

### The rating rows take server values themselves

- The round star rows (break rating card and final form) and the session scale rows (final form) take the server's saved value for every row that isn't waiting on a tap of its own, whenever the saved values they're given change. A row that's saving keeps its tap. A row that just saved or failed keeps its status until the server's value for it changes.
- On a reconnect, the saved values come from the join reply. A row still saving on the old connection isn't shown as saved: as today, its acknowledgement never resolves as a success.
- This follows the pattern the feedback comment box already uses (adopt the server's text unless there are unsent edits).
- The ratings counter and the re-mount keys built on it are deleted.

### Docs

- `DOCUMENTATION.md`: drop answer-received from the server-to-client event list, say the submitting team's phones learn about their saved answer from the team view, and say feedback writes send the rating team a team view.
- `GLOSSARY.md`: the **Team view** entry already says "on every change to it", which is now true for feedback as well. Change it only if its wording names exceptions.
- Nothing changes on `/control`, so `/guide` stays as it is.

## Testing Decisions

Good tests here assert what a phone receives through the socket, what the team-link reducer holds afterwards, and what the play screen shows. They don't assert which fields the reducer stores or how a row decides to adopt a value.

All three seams already exist. No new seam is added.

- **Backend, through the socket interface with the real Postgres store.** Use the existing live-equals-resync property (the team view test utilities): after a round rating, a feedback send and a session rating, the last team view the team's connected phone received equals the team view a fresh rejoin gets. Add a privacy case: the feedback team view reaches only that team's sockets. In the answer submit specs, swap the answer-received assertions for the team view the submitter's socket receives. Prior art: the team view, team view answers, joker pick and rate session specs in the game test suite.
- **Frontend, through the team-link reducer** (its existing test seam): a join accept holds the embedded team view; a team view replaces it wholesale; the pending answer and attempt survive a replace; clearing drops it; the joker notices fire on a drawn or moved joker and not on a chosen one. The tests for the five saved actions and for answer-received are deleted. Prior art: the team-link team data and reducer edge tests, plus the hook's team data tests.
- **Frontend, through the play screen's existing tests**:
  - a team view arriving while a round rating is saving keeps the tap, and its "Saved ✓" appears once the acknowledgement lands;
  - a team view carrying a rating from the team's other phone fills an idle row;
  - a failed row keeps its retry prompt when an unrelated team view arrives;
  - the same three cases for the final form's star and scale rows;
  - after a reconnect, the card shows the join reply's ratings.

  Prior art: the rate-the-rounds, rate-the-rounds final form and final feedback comment topics tests.
- Run `pnpm crap:changed` before closing, plus the frontend mutation run on the team-link reducer and the rating rows.

## Out of Scope

- The other candidates from the 2026-11-21 review: the graded question's answers module for `/control` and `/remote`, round identity across a live edit, the Live results cache and the Coin ledger's purchase source, the Bonus award policy, and the selected-question projection on the phone. The last one builds on this spec.
- Sending a team view only when it actually changed (diffing). That's still the upgrade path if the extra sends show up as slow.
- The bonus-awarded and coin-awarded toasts. They stay separate one-off events.
- Any change to what the team view contains, or to how the server projects it.
- The `GLOSSARY.md` "Live results" drift noted in the review (it belongs to the Live results candidate).

## Further Notes

- The user confirmed the seams above (2026-11-21). They're the three seams team-view-projection already used, with no new one.
- Removing answer-received changes the protocol between the backend and the phone. Both apps deploy together. A phone still on the old bundle after a deploy simply never gets the event it listens for, and it still receives team views, so it keeps working until it reloads.
- The extra team view on a feedback write costs one projection for one team, which is negligible at pub-quiz scale.
- ADR 0004 is unaffected: the phone still reads doubled rounds from the team view and never works them out.
