# Spec: Leagues — ranking teams across a semester

Status: ready-for-agent

Blocked by: team-page, feedback-trends

## Problem Statement

Teams are persistent across nights, but each night's result stands alone. There's no answer to "who's winning this semester?", and nothing on the big screen or the phones gives teams a reason to come back next week.

## Solution

Admins create **leagues** (see `GLOSSARY.md`: **League**, **League points**, **League table**): a name plus a start and end date shown as a label. Membership is **opt-in**. When creating a session, or editing its settings while it's live, staff tick the leagues it counts towards. A session can be in several leagues. A session counts towards a league once it has been added to it and has ended. Admins can add ended sessions to a league, or remove them, from the league's admin page, to fix a forgotten or wrong tick.

The dates never decide membership. They do decide which leagues are **current**: those whose end date is today or later. Current leagues are the ones offered when ticking, listed first on `/league` and shown on the team page.

Each session gives every team that played it **league points**: 5/4/3/2/1 for placing 1st–5th (tied teams each get their shared place's full points), nothing below 5th, plus one participation point for having answered at least one question. A team that left the session has no placing, so it gets the participation point only. The **league table** ranks teams by league points. Teams level on points are split by more nights won, then by better average placing, and otherwise share the position.

The table appears:
- on a public `/league` page (no login),
- on the team page (`.scratch/team-page`), as the team's position in each current league,
- on the big screen lobby, as the top 5 of the session's league (if it's in several, the one created most recently),
- as a "League" preset on the feedback trends filter (`.scratch/feedback-trends`).

## User Stories

1. As an admin, I want to create a league with a name and its dates, so that a semester has its own table.
2. As an admin, I want to rename a league and change its dates, so that a typo isn't permanent.
3. As an admin, I want to delete a league, which removes only the league and its memberships, never any session data.
4. As a quiz master or moderator creating a session, I want to tick the current leagues it counts towards, so that it's in the table without anyone following up.
5. As a quiz master or moderator, I want to change those ticks in session settings until the session ends, so that I can fix a mistake on the night.
6. As an admin, I want to add an ended session to a league or remove it, from the league's page, so that a forgotten tick can be fixed afterwards.
7. As a quiz master, I want a session with no league ticked to count towards none, so that private events stay out by default.
8. As anyone, I want a public league page with the table, so that teams can check it without logging in.
9. As a team, I want to see each team's points, nights played, nights won and average placing, so that the ranking is transparent.
10. As a team, I want our league position on our team page, so that we see where we stand.
11. As a team in the room, I want the big screen lobby to show the league's top 5 before the quiz starts, so that there's something to play for.
12. As a team that came but left early, I want my participation point, so that showing up counts.
13. As an organiser, I want the feedback trends filter to offer a league, so that I can review a league's feedback in one click.

## Implementation Decisions

- Storage: a `leagues` table (`id`, `name`, `startsOn`, `endsOn`, with `endsOn ≥ startsOn`, `createdAt`) and a `league_sessions` join table (league, session; unique; cascade on both). Migration via `db:migrate:create`. "Current" means `endsOn ≥ today` in the venue's time zone (`Europe/Prague` unless a time-zone setting already exists).
- Session membership travels with the session:
  - `CreateSessionPayload` gains `leagueIds: number[]` (optional, default `[]`).
  - The session settings patch gains `leagueIds`, accepted until the session ends.
  - Both are Zod-validated, and every id must be an existing current league; otherwise 400.
  - Writes replace the session's set. Open to anyone who can create a session (admin and moderator).
- League-admin REST (`@Roles('admin')`): create, update and delete a league; add or remove an **ended** session (works for any league, current or not).
- Staff read (admin and moderator): list leagues with their sessions; `GET /leagues?current=true` feeds the session form's checkboxes.
- League points and the table are one pure module, from per-session placings (from the Standings module; **Placing** isn't recomputed) plus "answered at least once" flags. Constants: `LEAGUE_PLACING_POINTS = [5, 4, 3, 2, 1]`, `PARTICIPATION_POINTS = 1`.
- Public, no auth: `GET /leagues/public` (name, dates, current flag) and `GET /leagues/:id/table` (team name, league points, nights played, nights won, average placing, position). No codes, no feedback.
- Pages:
  - Admin `/leagues`: list and create/edit, plus per league its sessions with remove, and "Add a session" picking from ended sessions not yet in it.
  - The session-create form and the `/control` session settings panel: league checkboxes (current leagues only, plus any league the session is already in).
  - Public `/league`: current leagues first, then the rest; the table for the selected one.
- The team page shows, for each current league, the team's position and points ("3rd of 18 · 14 pts"), or nothing if the team has no points there.
- Big screen lobby: the lobby display view carries `leagueTop` (name plus top 5 rows) for the session's league; if several, the one created most recently; if none, `null`. The current session isn't counted yet, since it hasn't ended.
- Feedback trends: an optional `leagueId` selects that league's sessions, and the filter gains a league picker.
- Rename the "full league roster" comment in `team.service.ts` to "team directory": "league" now means something else.

## Testing Decisions

- The pure league module: the points scale, shared placings, left teams getting the participation point only, zero-answer teams getting nothing, every tie-break step, and an empty league.
- Real Postgres:
  - only ended member sessions count;
  - a session in two leagues counts in both;
  - non-member sessions never count;
  - creating or patching with a non-current or unknown league → 400;
  - ticks are refused after the session ends (only the league admin page changes them then);
  - moderators can tick but not manage leagues (403);
  - the public endpoints leak nothing extra.
- Frontend: admin page, the session form's and settings panel's checkboxes, public page, team-page position, lobby top 5 (and its absence).
- `/guide` explains ticking a league when creating a session.

## Out of Scope

- Different points scales per league.
- Divisions, promotions or prizes.
- Live (mid-session) league projections.
- Freezing a league after its end date. The admin can still change it.
