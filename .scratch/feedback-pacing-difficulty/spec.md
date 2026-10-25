# Spec: Pacing and felt difficulty, and a tidier session stats page

Status: ready-for-agent

Blocked by: —

## Problem Statement

Round ratings tell the organiser which rounds landed, and the comment box catches the rest. Neither says whether the night as a whole moved too slowly or was too hard, and those two are what the organiser most often wants to change. A free-text comment rarely mentions them, and when it does it can't be counted or compared from one night to the next.

The session stats page also lacks a single figure for how well the night was rated: the trends page has one per session, but the session's own page doesn't. Its rounds table has no response times. Meanwhile two of its top tiles ("Fastest answer", "Fastest team") earn their space less than the figures above would.

## Solution

The final feedback form asks two fixed questions, the same every session, so nights can be compared (see `GLOSSARY.md`: **Pacing**, **Felt difficulty**):

- "How was the pace?": **Too slow · Just right · Too fast**
- "How hard were the questions?": **Too easy · Just right · Too hard**

Staff read the answers, as anonymous counts, on the session stats page, the feedback trends page and the night brief.

The session stats page also gains a **Session rating** tile (the average of every round rating, as on the trends page) and an **Avg. response** column on its rounds table, and it loses the "Fastest answer" and "Fastest team" tiles.

## User Stories

1. As a team, I want to say in one tap whether the night was too slow or too fast, so that the quiz master can fix it next time.
2. As a team, I want to say in one tap whether the questions were too easy or too hard.
3. As a team, I want my answer kept even if I never press Send on the comment, so that putting the phone away doesn't lose it.
4. As a team, I want to change my answer while the form is open.
5. As a team, I want these answers anonymous, like my round ratings.
6. As an organiser, I want each session's pacing and felt-difficulty counts on its stats page, in the night brief and on the trends page, so that I can spot a pattern across nights.
7. As an organiser, I want one session rating at the top of a session's stats page.
8. As an organiser, I want each round's average response time, so that I can see which rounds dragged.
9. As an organiser, I want the "Fastest answer" and "Fastest team" tiles gone, so that the top of the page holds what I act on.

## Implementation Decisions

### Phone and protocol

- Both are on the **final form only** (`feedback.kind === 'final_form'`), at the top above the round stars. The break card doesn't change.
- Each is a row of three buttons with the chosen one highlighted. Nothing is preselected. An answer can be changed but not cleared.
- **Saved on tap**, like `RATE_ROUND`: a new players-only event (suggested name `RATE_SESSION`, payload with the field being set and its value, Zod-validated against the three values of each scale), acked with `AckResult`. It is accepted only while the final form is open, so it goes through the same rule as `SEND_FEEDBACK` (`getFeedbackField` / `describeFeedback`), and it is refused with "Feedback is off for this session" when `collectFeedback` is off. Its check and its store run inside the session write; nothing is broadcast and no scores change.
- One answer per (session, team) for each scale, last write wins. **`SEND_FEEDBACK` must not wipe them**, because it currently replaces the whole `session_feedback` row. Whether they live on that row (as new nullable columns, written without touching comment and topics) or in a table of their own is the implementer's call; record the choice in `DOCUMENTATION.md`.
- A team's own answers come back on join, the way its round ratings and `TeamFeedbackView` do, so a reconnecting phone shows its choice.
- They inherit the form's existing rules: hidden when `collectFeedback` is off, waiting for any showdown to be decided, kept when Previous steps back out of `ended`. Team merge follows whatever rule already applies to `session_feedback` (the team-merge service lists that table). The team page never shows them.

### Big screen

- The `ended` thank-you invitation becomes "Tell us how it went on your phone ★". The break's "Rate the rounds on your phone ★" stays.

### Session stats (`/stats/:id`)

- New top tiles:
  - **Rating**: "★ 4.2", with "37 ratings" as the detail. It is the mean of every round rating in the session, each counting once (the same figure as the trends page's per-session `rating`). It shows "—" when nobody rated.
  - **Pacing** and **Felt difficulty**: the value is the most common answer ("Just right"), or "Mixed" when the top two tie. The detail lists all three counts in scale order ("too slow 2 · just right 7 · too fast 1"). It shows "—" when nobody answered.
  - With `collectFeedback` off, all three tiles read "Feedback was off".
- The existing **Difficulty** tile (measured from scores) stays as it is, so it isn't confused with Felt difficulty.
- **Removed:** the "Fastest answer" and "Fastest team" tiles, together with `pickFastestAnswer` and `pickFastestTeam` in `session-detail.calc.ts`, the `fastestAnswer` and `fastestTeam` fields on `SessionDetailHighlights`, the `SessionDetailFastestAnswer` and `SessionDetailFastestTeam` types, and their tests. The standings' per-team avg response and the questions' `fastestResponseMs` stay.
- **Avg. response** column on the rounds table: the mean `responseMs` over the round's answers that have one, `avgResponseMs: number | null` on `SessionDetailRoundRow`, drawn with `formatResponseMs` (so "Not recorded" when none). `DOCUMENTATION.md` notes the caveat: in a normal block a question stays open until the block locks and `responseMs` runs to a team's last edit, so revisions in the final countdown inflate a round's average. Kahoot rounds give clean times.
- Aggregated in SQL or from rows without any team id or name reaching the response, like ratings today.

### Feedback trends (`/stats/feedback`)

- Each `FeedbackTrendsSession` gains `pacing` and `feltDifficulty` counts. The sessions table gets **Pacing** and **Felt difficulty** columns drawn as "2 · 7 · 1" in scale order, or "—" when nobody answered. The existing date-range and league filters apply unchanged.
- No "mostly too slow" flag, and no best/worst lists for these.

### Night brief

- The session-level lines gain the session rating (average and count, or "no ratings") and the Pacing and Felt difficulty counts. With `collectFeedback` off, the existing "Feedback was off." covers them. No per-round response time.

### Docs

- `DOCUMENTATION.md`: the feedback field and final form, the new event, storage, the `ended` screen wording, the session detail (tiles, round column, removed highlights), the night brief and feedback trends.
- `GLOSSARY.md` already has **Pacing**, **Felt difficulty** and **Session rating**.
- The `/guide` page needs no change, because `/control` doesn't change.

## Testing Decisions

- Shared: the scale values' Zod schema, and the accept/refuse rule (final form open, feedback off, showdown in play).
- Backend on real Postgres: saving and overwriting an answer; `SEND_FEEDBACK` leaving them alone and vice versa; restore on join; counts on the session detail, the trends and the brief; no team data in any response; the session rating as a mean of ratings, not of round averages; the round avg response, with null when none are recorded.
- Frontend: the form's two rows (no preselection, the highlight, save on tap, restore); the three tiles and their "—", "Mixed" and "Feedback was off" states; the removed tiles gone; the round column with "Not recorded"; the trends columns.

## Out of Scope

- Asking pacing or felt difficulty on the break card.
- Quiz-master-defined feedback questions, or per-prompt on/off switches.
- An overall star rating for the night. The session rating comes from the round ratings.
- Any change to the measured Difficulty tile or the standings' response times.
