# Spec: Teams rate the rounds and leave feedback from their phones

Status: ready-for-agent

Blocked by: —

## Problem Statement

After a quiz night the quiz master has no idea how the rounds landed. They can see from the session stats which rounds were hard (correct rate, points earned), but not which ones the room enjoyed, what annoyed people, or which topics teams would like next time. Getting this today means walking round the tables or posting a form link nobody opens. By then teams are putting their coats on, and nobody remembers what round 2 was about.

Teams already have the right device in their hands: their phone is on `/play` for the whole night, and it has nothing to do during a break.

## Solution

Teams give **feedback** from the phone they play on, and it is always optional:

- **In each break**, a "Rate these rounds" card sits at the top of the phone's block browser. It has a row of 1–5 stars for each round of the block that just locked. A tap saves straight away and the row shows "Saved ✓". If the save fails, the row shows "Not saved — tap to retry". Once every round on the card is rated, the card collapses to "Rated ✓ · edit".
- **When the quiz ends** (after any showdown is decided), the phone shows "Quiz complete!" followed by the final feedback form:
  - every round with its stars, filled in with the break ratings and editable. Kahoot rounds have no break, so this is the only place they are rated.
  - an "Anything else?" text box
  - topic suggestions: one line per topic, with "+ Add another" for up to 10 lines
  - a Send button for the text, which shows "Sent ✓" and can be pressed again after an edit
- The **big screen** reminds the room: "Rate the rounds on your phone ★" on the break card, and "Tell us what you thought — on your phone" on the final screen.
- Feedback stays editable for as long as the session is `ended` and the team's phone is on it. A phone that reconnects shows exactly what the team has already saved.
- The quiz master sees the results only on the **session stats** page:
  - a Rating column in the rounds table ("★ 4.2 · 9 teams")
  - a Comments section, newest first
  - a Topic suggestions section, grouped regardless of capitals or spaces and sorted by count

  Staff never see which team gave which feedback.
- A session setting, **Collect feedback**, is on by default and can be changed only in the lobby, like every other session setting. When it is off, phones and the big screen show nothing about feedback, and the stats page says "Feedback was off for this session".

## User Stories

1. As a team, I want to rate each round of the block we just finished during the break, so that I give my opinion while the round is still fresh.
2. As a team, I want to rate a round with one tap on 1–5 stars, so that rating takes no effort on a phone.
3. As a team, I want each star tap to save immediately, so that nothing is lost if the phone sleeps or we forget to press a button.
4. As a team, I want a "Saved ✓" mark next to a round once its rating reached the server, so that I know it counted.
5. As a team, I want a "Not saved — tap to retry" message when a rating didn't reach the server, so that I know to tap again instead of assuming it worked.
6. As a team, I want to change a rating during the same break, so that a mis-tap isn't final.
7. As a team, I want the rating card to collapse once every round on it is rated, so that it stops pushing our answers down the screen.
8. As a team, I want to reopen a collapsed rating card, so that I can still change a rating during the break.
9. As a team, I want the rating card to sit above the block browser rather than replace it, so that I can still check our answers during the break.
10. As a team, I want to skip rating entirely, so that feedback never gets in the way of playing.
11. As a team, I want to see a final feedback form on my phone when the quiz ends, so that I can sum up the night without opening another link.
12. As a team, I want the final form to show our break ratings already filled in, so that I don't have to rate everything again.
13. As a team, I want to change any earlier rating on the final form, so that my opinion of a round can change after seeing the answers.
14. As a team, I want to rate kahoot rounds on the final form, so that rounds without a break still get feedback.
15. As a team that joined late, I want to be able to rate every round on the final form, so that the form doesn't treat us differently.
16. As a team, I want an "Anything else?" text box, so that I can say things the stars can't.
17. As a team, I want to suggest topics for future rounds, one per line, so that the quiz master knows what we'd like next time.
18. As a team, I want a "+ Add another" button that adds a new topic line, so that I can suggest as many topics as I like up to a sensible limit.
19. As a team, I want empty topic lines to be ignored, so that adding a line by accident doesn't send a blank topic.
20. As a team, I want a Send button for the text, which shows "Sent ✓" afterwards, so that I know our comment and topics were received.
21. As a team, I want to edit the text and press Send again, so that I can add a topic I forgot.
22. As a team, I want the form to tell me when a text is too long or there are too many topics before I press Send, so that I'm not refused without knowing why.
23. As a team, I want the final form to wait until the showdown is decided, so that the tiebreak gets everyone's attention.
24. As a team, I want my phone to show our saved ratings and text again after it reconnects, so that a dropped connection doesn't make it look like we lost our feedback.
25. As a team, I want our feedback to be anonymous to the staff, so that I can say honestly that a round was boring.
26. As a team whose phone was kicked and re-linked, I want our feedback to still be there, so that it belongs to the team rather than the device.
27. As someone in the room, I want the big screen to say "Rate the rounds on your phone ★" during the break, so that I know the form exists.
28. As someone in the room, I want the final screen to say "Tell us what you thought — on your phone", so that we fill in the form before leaving.
29. As a quiz master, I want a "Collect feedback" switch in the session settings, so that I can run a session without it (e.g. a private event).
30. As a quiz master, I want the switch on by default, so that I don't have to remember to turn it on.
31. As a quiz master, I want the switch to be changeable only in the lobby, like the other settings, so that the room doesn't see the form appear or disappear mid-quiz.
32. As a quiz master, I want no feedback prompt on phones or the big screen when the switch is off, so that the session looks exactly as it did before this feature.
33. As a quiz master, I want each round's average rating and the number of teams that rated it in the session stats rounds table, so that I can compare rounds at a glance.
34. As a quiz master, I want "—" for a round no team rated, so that "no ratings" doesn't look like a bad rating.
35. As a quiz master, I want every "Anything else" comment listed newest first on the session stats page, so that I can read what teams said.
36. As a quiz master, I want comments shown without team names, so that teams trust the form enough to be honest.
37. As a quiz master, I want topic suggestions grouped regardless of capitals or spaces and sorted by how many teams suggested them, so that I can see at once what the room wants most.
38. As a quiz master, I want the stats page to say "Feedback was off for this session" when the switch was off, so that empty sections aren't mistaken for no one bothering.
39. As a quiz master, I want stepping back out of `ended` to hide the final form and keep everything already given, so that a mistaken Advance costs nothing.
40. As a quiz master, I want the `/guide` page to explain the switch and where results appear, so that a new moderator knows the feature exists.
41. As a team that has moved on to the next session, I want my old session's feedback to stay as it was, so that what we said about last time doesn't change.

## Implementation Decisions

- **Domain terms** are already in `CONTEXT.md`: **Feedback**, **Round rating** and **Topic suggestion**. Use these words in code, events and UI copy, and avoid "survey", "review" and "round score".
- **New session setting** `collectFeedback: boolean`, defaulting to `true`. It is added to the settings type, the defaults, the partial-settings Zod schema and the lobby settings panel on `/control`. A stored settings JSON without the field reads as `true`, so sessions created before this feature have feedback on. Existing rule: settings can't change after the quiz has started.
- **Schema**: two new tables, both cascading on session delete.
  - **round rating**: game session, round, team, stars (int 1–5), timestamps. Unique on (session, round, team), and saving again overwrites (last write wins, like answers). A rating for a round that is later deleted from the quiz (live edit or re-import) goes with the round.
  - **session feedback**: game session, team, comment (text, may be empty), topics (JSON string array, parsed with Zod on read, never cast), timestamps. Unique on (session, team), and Send replaces the whole row.
  - Both store the team so that it can edit its own feedback, but no read path that reaches staff exposes the team.
- **Which rounds are open for rating** is worked out by the server, next to the existing phone-screen projection in the shared on-air screen module, from the session's progress, quiz structure, showdown state and the `collectFeedback` setting:
  - the setting is off → nothing
  - in one of the break statuses → the rounds of the current block. Kahoot rounds never reach a break, so they never appear here.
  - `ended` with no showdown still being played → every round of the quiz
  - otherwise (answering, revealing, lobby, a showdown being played at `ended`) → nothing

  The players view gets this as a feedback field that the whole players room shares: whether it is the break card or the final form, plus the rounds as id and title. The phone draws from it and never decides for itself. The same rule decides whether the server accepts a rating, so the projection and the check can't disagree.
- **Display prompt**: the display screen projection's break card and ended screen carry a flag that says whether to show the feedback prompt (true when `collectFeedback` is on). `/display` draws the line from that flag.
- **New socket events (players-only, room membership checked server-side like `SUBMIT_ANSWER`):**
  - **Rate round**: `{ roundId, stars }`. Validated with Zod (integer 1–5). Accepted only if the round is open for rating right now (rule above) and the team is on the session's roster. The ack reports success or a refusal reason ("Feedback is off for this session", "This round can't be rated right now"). The ack is what drives "Saved ✓" or "Not saved — tap to retry".
  - **Send feedback**: `{ comment, topics }`. The comment is at most 1000 characters. Topics are at most 10 entries of at most 60 characters each; entries are trimmed and empty ones dropped before saving. Accepted only at `ended` with the final form open. The ack drives "Sent ✓".
  - Neither event broadcasts anything. They change no session state, standings or snapshot, so they don't go through the session write: they are a plain team-scoped database write followed by an ack.
- **Reconnect**: the join-accepted payload gains the team's own feedback for the session (its round ratings as round id and stars, plus its comment and topics, or empty), next to the answers and bonus awards it already restores. A phone that reconnects draws its stars and text from this, so a tap whose save never arrived shows as empty again. There is no client-side retry queue.
- **Stepping back out of `ended`** needs no special handling. The projection stops listing rounds, the form disappears, the rows stay, and when the quiz reaches `ended` again the form comes back filled in from the team's saved feedback.
- **Phone UI** (`/play`):
  - The break card is drawn at the top of the `block` phone screen whenever the feedback field says "break card". It collapses to "Rated ✓ · edit" once every listed round has a saved rating.
  - The final form is drawn under "Quiz complete!" on the `ended` phone screen whenever the feedback field says "final form".
  - Star rows are buttons with accessible labels ("Rate Music 4 of 5").
  - "+ Add another" stops at 10 lines, and the form checks length limits before Send.
- **Stats**: the session detail stats gain:
  - per round, `rating: { average, count } | null`, where `null` means no ratings
  - a feedback section with `collected` (the session's setting), `comments` (text and submitted-at only, newest first, empty comments skipped) and `topics` (grouped, as described below)

  Topic grouping trims, collapses inner whitespace and ignores case. Each group shows its most common spelling (on a tie, the one submitted first) and is sorted by count, then alphabetically. The rounds table adds a Rating column, and the session detail panel adds the Comments and Topic suggestions sections, or the "Feedback was off" note.
- **Docs in the same change**: `DOCUMENTATION.md` (the new events, the players-view feedback field, the join payload addition, the setting, the stats additions) and the `/guide` page (the switch, the phone prompts, where results appear). `CONTEXT.md` is already updated.

## Testing Decisions

- **A good test checks only what clients receive or what the stats API returns.** Drive real sockets or call the real service, then check the payloads: the players view's feedback field, acks, the join-accepted payload, the display screen, the stats detail response. Don't check repository calls, table rows or helper internals.
- **Seam 1, the real-database game gateway harness** (testcontainers), which handles most cases:
  - The players view lists the block's rounds during `break_intro`, `break` and `break_round_intro`, and nothing during answering or reveal.
  - A block made of a kahoot round never produces a break card. At `ended`, every round, kahoot rounds included, is listed.
  - At `ended` with a showdown being played nothing is listed, and once the showdown is decided every round is.
  - With `collectFeedback` off, nothing is listed at any point, ratings and Send are refused with the "off" reason, and the display prompt flag is false.
  - A rating for a round outside the current block during a break is refused, a rating outside 1–5 is refused by validation, and a rating during answering is refused.
  - Rating the same round twice keeps the last value: a reconnect's join-accepted payload carries it.
  - Send replaces the earlier comment and topics, drops empty and whitespace-only topics, and is refused before `ended`. More than 10 topics or a topic over 60 characters is refused.
  - A reconnecting team gets its own ratings and text, and another team's phone never does.
  - Previous out of `ended` empties the feedback field, and Advance back to `ended` relists the rounds while the saved feedback is still returned on join.
  - Changing `collectFeedback` after the lobby is refused.
  - Prior art: `players-phone-screen.spec.ts` and `players-view.spec.ts` for the players view, `join-players.spec.ts` and `team-answers-sync.spec.ts` for the join payload, `ack.spec.ts` and `socket-payload-validation.spec.ts` for acks and validation, `update-session-settings.spec.ts` for the setting, `showdown-socket.spec.ts` for an `ended` with a showdown being played.
- **Seam 2, the stats service against real Postgres** (`stats.service.spec.ts` style):
  - average and count per round, and `null` for an unrated round
  - comments newest first, with no team id or name anywhere in the response
  - "Geography", " geography " and "GEOGRAPHY" counting as one topic with the most common spelling
  - `collected: false` for a session with the switch off
- **Seam 3, frontend component tests** (Vitest + Testing Library), fed with server-shaped data:
  - The phone break card shows a row per listed round, a tap sends the rating, and an ok ack shows "Saved ✓" while an error ack shows "Not saved — tap to retry". The card collapses when all rounds are rated and reopens on "edit".
  - The final form is filled in from the join payload, "+ Add another" stops at 10 lines, and Send shows "Sent ✓".
  - Nothing renders when the feedback field is empty.
  - On the stats page: the Rating column shows "★ 4.2 · 9 teams" and "—", the Comments and Topic suggestions sections render, and the "Feedback was off" note appears.
  - Prior art: `play/__tests__/break-and-reveal.test.tsx`, `join-and-reconnect.test.tsx`, `pre-game-screens.test.tsx`, and `stats/[id]/__tests__/session-detail-panel.test.tsx`.
- Existing specs stay green. The players view and the join-accepted payload gain a field, so a strict-equality test on either needs a mechanical update.

## Out of Scope

- Feedback from individual players (a per-person link or QR code). Feedback is per team.
- Showing ratings, comments or topics on `/control` during the live quiz, or on the big screen ("Favourite round" etc.).
- Showing which team gave which feedback, anywhere.
- Combining topic suggestions across sessions on the main `/stats` page, or a league-wide view.
- CSV export of feedback.
- Rating single questions, or any other scale than 1–5 stars.
- Closing feedback by hand or after a set time. It closes when the team joins another session.
- Changing the `collectFeedback` setting after the lobby.

## Further Notes

- Feedback changes no session state, so it stays outside the session write and the move plan. Nothing about it can block or slow a press.
- At pub-quiz scale (a few dozen teams), the stats aggregation can run per request with no caching.
- Anonymity applies to what staff see, not to what is stored: the team is stored so it can edit its feedback, and every read path towards staff must drop it. Test this explicitly in the stats service spec.
