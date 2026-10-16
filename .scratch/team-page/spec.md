# Spec: A team page opened with the team code

Status: ready-for-agent

Blocked by: —

## Problem Statement

After a quiz night, teams argue at the bar about what they answered and what the right answer was. The phone only shows the block browser while the session runs, and nothing afterwards. A team that comes back night after night also can't see its own history: the team stats page (`/teams/[id]`) is staff-only.

## Solution

A public **team page** at `/team`, opened with the **team code**. The code already proves the team's identity across nights, and it's the same code the team uses to rejoin. The page shows:

- The team's history: nights played, wins, podiums, best and average placing, and a list of its ended sessions with placing and points. This is the same figures staff see, minus anything staff-only.
- For each **ended** session: every question with the team's own answer, its verdict and points, and the correct answer.

Other teams' answers are never shown. A session appears only once it has ended. While it runs, the phone's block browser covers revealed verdicts. Feedback never appears, as on every other page.

## User Stories

1. As a team, I want to open our team page with our team code, so that only we can see our answers.
2. As a team on the phone we played on, I want the page to open without typing the code, so that it's one tap from the ended screen.
3. As a team, I want our history across nights (placings, wins, points), so that we can see how we're doing.
4. As a team, I want each night's questions with our answer, our verdict and the right answer, so that we can settle arguments.
5. As a team, I want a session to appear only after it has ended, so that nobody can use the page to peek at answers mid-quiz.
6. As a team, I want a clear message for a wrong code, so that I know to check it.
7. As a team that was kicked from a session, I want that night still listed (marked "left"), with whatever answers we gave.
8. As an organiser, I want repeated wrong codes slowed down, so that team codes can't be guessed.

## Implementation Decisions

- The team code is never put in a URL, so it stays out of logs and browser history. The page sends it in a POST body: `POST /team-page` `{ teamCode }` → history, and `POST /team-page/sessions/:sessionId` `{ teamCode }` → that night's detail. Both are public (no session cookie), validated with Zod and rate-limited with the existing throttler. A wrong code gets a generic 404, "No team with that code", which doesn't reveal whether a team name exists.
- The history reuses `TeamHistoryService` (the staff team page's source), so the figures match exactly. Staff-only fields aren't sent.
- The night detail covers only ended sessions the team was ever on the roster of. Otherwise it's the same 404. For each question in order: round title, question number and text, type, the team's answer (formatted by its answer kind), verdict, points earned and the question's points, and the correct answer. Media questions show their text and answer, not the media.
- On the phone the code comes from the team's stored team code (`team-storage.ts`). A phone without one shows the code form. The code entered is kept in memory only, not saved, unless the phone already stores it.
- The ended phone screen and the player menu gain "Our team page".

## Testing Decisions

- Backend on real Postgres: a right code → history equal to the staff view's figures; a wrong code → 404; a session that hasn't ended or a team not in the session → 404; no other team's answers in the detail; rate limit applied.
- Frontend: the code form, prefilled access from storage, the history list, the night detail and the error state.
- An e2e step at the end of the quiz-night journey: the ended screen links to the team page and it shows the team's answers.

## Out of Scope

- The league position (added by `.scratch/league`).
- Seeing other teams' answers or full standings beyond the team's own placing.
- Changing or resetting the team code from this page.
