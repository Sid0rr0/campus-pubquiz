# Spec: Feedback trends across sessions

Status: ready-for-agent

Blocked by: —

## Problem Statement

Each ended session's stats page shows its round ratings, comments and topic suggestions, but only for that one night. To plan the next quiz, the organiser has to open every session and compare by hand: are ratings going up, which rounds landed best, which topics keep being asked for?

## Solution

A staff page, **Feedback trends**, under `/stats` reads feedback across many sessions at once, for a chosen date range (all time by default):

- **Ratings over time**: each ended session in the range with its average round rating and how many ratings it got, oldest to newest.
- **Best and worst rounds**: the top and bottom rounds by average rating, each with its title and session, counting only rounds with at least `MIN_RATINGS_FOR_RANKING` (3) ratings.
- **Topic suggestions**: suggestions from every session in the range, grouped the way a single session's are (trim, collapse inner whitespace, ignore case, show the most common spelling), sorted by count.

Rounds aren't shared between quizzes, so a round here always means one round in one session. Feedback stays anonymous: no team id or name reaches the response or the page.

When the League arrives (`.scratch/league`), the filter gains a "League" choice that selects that league's sessions instead of a date range.

## User Stories

1. As an organiser, I want to see the average round rating of every session over time, so that I know whether the quizzes are getting better.
2. As an organiser, I want the best- and worst-rated rounds across many sessions, so that I know what to repeat and what to drop.
3. As an organiser, I want rounds with only one or two ratings left out of best/worst, so that one enthusiastic team doesn't decide it.
4. As an organiser, I want topic suggestions counted across sessions, so that I can see what the crowd keeps asking for.
5. As an organiser, I want to narrow it all to a date range, so that I can look at one semester.
6. As a team, I want my feedback to stay anonymous on this page too.
7. As an organiser, I want sessions with feedback turned off left out of the ratings (not shown as zero), so that the trend isn't dragged down.

## Implementation Decisions

- REST: `GET /stats/feedback-trends?from=&to=` (ISO dates, both optional, validated with Zod), under the same guards as the other stats endpoints (admin and moderator). It covers ended sessions whose date falls in the range.
- The response is `{ sessions: [{ id, name, date, rating: { average, count } | null }], bestRounds, worstRounds: [{ sessionId, sessionName, roundTitle, average, count }], topics: [{ topic, count }] }`. Everything is aggregated in SQL, and no team column is selected.
- The topic grouping reuses the function the session detail already uses. It isn't copied.
- A session with `collectFeedback = false` is left out of `sessions` and the rankings.
- Page: `/stats/feedback`, linked from `/stats`. It has a from/to filter, a sessions table (with a simple line of averages if it reads well; see the `dataviz` skill), two short round lists and a topic list. Empty states are written out, never zeros.

## Testing Decisions

- The stats service on real Postgres: averages and counts per session; the ranking threshold; best/worst order; topics merged across sessions; the range filter; sessions with feedback off skipped; no team data in the response.
- The page renders each section and its empty state.

## Out of Scope

- Comments across sessions (they stay on each session's page).
- Matching "the same round" across quizzes by title.
