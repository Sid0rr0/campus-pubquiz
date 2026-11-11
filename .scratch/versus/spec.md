# Spec: Versus

Status: ready-for-agent

Blocked by: none

Source: grilling session 2026-11-11 ("add a versus mode to session where teams can pick a side (2 or more) and fight for it; the leaderboard shows a bar of which side has more points"). The **Versus** and **Side** terms in `GLOSSARY.md` were settled in that session.

## Problem Statement

Campus nights often pit groups against each other: faculties, societies, year groups, halls. Each team plays for itself, and the quiz has no way to show that a bigger rivalry is going on. The quiz master can't say "tonight it's Engineering vs Law" and have the screens follow it. Teams can't declare which camp they're playing for, and nobody can see which camp is ahead. The only way to do it is for the quiz master to add up scores by hand, and that's unfair when one camp brought more teams than the other.

## Solution

A new session setting, **Versus**, for pub quiz sessions only. The quiz master names two to four **Sides** for the night. Each team picks its side on its phone when it joins and can switch until the quiz starts. After that only the quiz master can move a team.

A side's strength is the average leaderboard total of its teams, so a side with more teams doesn't win by headcount. The leaderboard shows a bar split by each side's share of those averages:
- **Big screen:** the bar holds the earlier split while the ranks are revealed and slides to the new split once the top rank is revealed.
- **Phones:** the bar highlights the team's own side.
- **`/control`:** the quiz master sees the bar too.

The big-screen lobby shows how many teams are on each side. When the quiz ends, the ended screen names the winning side, or a tie. Sides belong to the session alone and are never recorded anywhere else.

## User Stories

1. As a quiz master, I want to turn Versus on for a session, so that the night becomes a contest between camps as well as between teams.
2. As a quiz master, I want to name between two and four sides, so that I can match the rivalry of the night (e.g. "Engineering" and "Law").
3. As a quiz master, I want blank or duplicate side names refused, so that no team picks between two identical-looking choices.
4. As a quiz master, I want to be refused a fifth side, so that the bar stays readable on a phone.
5. As a quiz master, I want to set up Versus when I create the session and change it in the lobby, like other session settings, so that I can adjust before the quiz starts.
6. As a quiz master, I want Versus settings frozen once the quiz has started, like other session settings, so that the contest can't be redefined mid-game.
7. As a quiz master, I want renaming a side to keep its teams on it, so that fixing a typo doesn't make teams pick again.
8. As a quiz master, I want removing a side refused while any team is on it, so that I don't silently strand teams without a side.
9. As a quiz master, I want turning Versus off to discard every team's pick, so that a session without Versus carries no leftover sides.
10. As a quiz master, I want turning Versus on after teams have joined to prompt those teams' phones to pick a side, so that I don't have to tell them to rejoin.
11. As a quiz master, I want Start quiz refused while any team on the roster has no side, with a message naming why, so that every team is on a side when the contest begins.
12. As a quiz master, I want the Versus setting not offered for a quickfire quiz's sessions, so that it only appears where it applies.
13. As a quiz master, I want to see each team's side in the roster on `/control`, so that I know who is playing for whom.
14. As a quiz master, I want to move a team to another side at any point in the session, so that I can fix a team that tapped the wrong side.
15. As a quiz master, I want the side bar on `/control`, so that I can talk up the rivalry from the laptop.
16. As a team, I want to pick a side when I join a session played with Versus, so that I'm fighting for my camp.
17. As a team, I want the side picker to be part of joining, not something I can skip, so that I can't accidentally play side-less.
18. As a team, I want to switch sides from my phone until the quiz starts, so that I can join my friends' side after talking it over.
19. As a team, I want my phone to refuse a side switch once the quiz has started, so that nobody can jump to the winning side at the last break.
20. As a team joining after the quiz started, I want to pick my side once when I join, so that late teams can still take part in the contest.
21. As a team, I want my phone to remember my side after reconnecting, so that a dropped connection doesn't move me.
22. As a team, I want a small badge with my side next to my team name on my phone, so that I always see which side I'm on.
23. As a team, I want the side bar on my phone's leaderboard with my side highlighted, so that I can see how my side is doing.
24. As a team, I want the bar to show each side's average points and its percentage, so that I understand what the bar measures.
25. As a team, I want the side's strength to be an average per team, not a sum, so that my side isn't beaten just because the other side brought more teams.
26. As a team, I want my full leaderboard total (joker and extra-joker doubling, bonuses and penalties) to count for my side, so that the bar agrees with the board.
27. As an audience at the venue, I want the big-screen lobby to show how many teams are on each side, so that the rivalry is visible before any points are scored.
28. As an audience, I want the big-screen leaderboard to show the side bar, so that the room can cheer for its side.
29. As an audience, I want the bar to stay at the previous split while ranks are revealed and then slide to the new split after the top rank, so that the side swing is the last reveal of the board.
30. As an audience, I want a colour dot on every big-screen leaderboard row, so that I can see which side each team plays for.
31. As an audience, I want each side to have its own distinct colour, used the same way on every screen, so that I can tell sides apart at a glance.
32. As an audience, I want the ended screen to name the winning side, or say it's a tie, so that the contest has a result.
33. As a team on a side whose teams have lost points to penalties, I want the bar to treat a negative average as no share while still showing the real average, so that the bar never draws a negative segment.
34. As an audience, I want the bar split evenly when no side has scored yet, so that the start of the night looks fair.
35. As an audience, I want a side with no teams counted to show 0% and "no teams", so that it's clear why it's empty.
36. As a team on a side, I want a team that left (kicked or departed) to stop counting for the side, so that the bar matches the board, which doesn't show it either.
37. As a team on a side, I want a team that never took part removed from the side's average once the session ends, so that an idle roster entry doesn't drag us down on the final result.
38. As a quiz master, I want the bar on a big screen that reconnects or reloads to look the same as on the others, so that every screen agrees.
39. As a quiz master, I want the bar after a backend restart to draw the current split without a slide (no prior standings), so that it never shows a made-up swing.
40. As a quiz master, I want the side bar to leave showdowns alone, so that a tiebreak between teams stays about those teams.
41. As a team, I want my side to stay within this session, so that it doesn't appear on my team page, in the league or in stats.
42. As a quiz master, I want a team merge to ignore sides, so that merging teams after the night isn't complicated by a contest that is over.
43. As a quiz master reading `/guide`, I want the Versus setting and moving a team between sides explained, so that I know how to run a Versus night.

## Implementation Decisions

- **Domain language.** Use **Versus** (the session setting) and **Side** (a named camp) as defined in `GLOSSARY.md`. Never "versus mode": **Quiz mode** is something else.
- **Settings shape.** The session settings gain a Versus switch and a list of sides. Each side carries a stable id and a name, so a team's side survives renames and the removal of other sides. Side ids are generated by the server, or the client, at the boundary. The colour is not stored: it is the side's position in the list mapped onto a fixed four-colour palette.
- **Settings validation.** The Zod schema for session settings validates the side list: 2–4 sides when Versus is on, names trimmed, non-blank, unique ignoring case. The settings change refuses any of the following, with clear messages, in the same style as the jokers-need-overview refusal:
  - removing a side that a roster team is on
  - turning Versus on for a quickfire quiz's session
  - any Versus change after Start quiz
- **Turning Versus off** clears every roster team's side in the same session write.
- **Team side storage.** A team's side is a nullable side id on its roster row for the session (the session–team join). It is read into session state's roster entries when the session is placed and as teams join, like the other per-team caches.
- **Kicked and departed teams.** Kicking a team or a team leaving deletes the roster row, so the side goes with it. This matches "a team that left doesn't count". A kicked team that rejoins picks again.
- **Migration.** One MikroORM migration adds the column. Settings live in the existing settings JSON, so they need no migration beyond defaults (Versus off, no sides).
- **Socket events.** All of these go through the **Session write** like every live change. Each says it touches scores: false, though it changes the side figures (see Live figures).
  - A players-room event to pick or switch the team's own side. It is allowed in the lobby, and when the team has no side yet (a late join or Versus just turned on). It is refused once the quiz has started and the team already has a side. An unknown side id is refused.
  - An admin-room event to set any roster team's side, allowed at any status.
  - Both are added to the socket-event authorization declarations.
- **Joining.** Joining doesn't take a side. While Versus is on, a team without a side gets a phone screen that requires a pick before anything else. The picker reuses the joker pick's phone pattern, but it is not a status: the quiz carries on underneath, and the picker covers the team's phone only.
- **Start quiz guard.** Start quiz is refused while Versus is on and any roster team has no side. The refusal message is shown on `/control` the same way as other refused presses.
- **Side standings module (new, shared types, pure).** Given the leaderboard entries (all of them, not the capped board), each team's side id, which teams count (took part and haven't left, by the same rule the leaderboard uses), and the session's sides, it returns, per side and in side order:
  - id, name and colour index
  - counted team count
  - average total
  - share
  - whether it leads

  It also returns whether the leaders are tied. Share is the side's average floored at 0, divided by the sum of floored averages; when that sum is 0, every side gets an equal share. A side with no counted teams has a null average and a share of 0 when others have scored. It is one function, called for the current entries and for the prior standings' board.
- **Live figures.** Side standings are derived from the leaderboard the session already holds, so no extra read is needed. Because a side pick or move changes the figures without touching scores, the views compute them from session state on every emit, not in **Live results**.
- **Views.**
  - The display view's leaderboard board gains the side bar: the current split, plus the prior split when prior standings exist. It also gains each shown entry's side id for the row dot.
  - The display lobby gains the team count per side.
  - The players view gains the team's own side id and the side bar on the phone leaderboard.
  - The admin view gains each roster team's side and the current side bar.
  - The ended screen description gains the winning side, or a tie.
  - Nothing is sent when Versus is off.
- **Big-screen bar timing.** `/display` draws the prior split while the reveal count is below the board's reveal target and slides to the current split once the top rank is revealed. The decision uses the reveal count and target the display already has, so a reconnecting screen draws the same thing. With no prior split, it draws the current split without a slide.
- **No persistence beyond the session.** Session result, stats, team page, league points, league table and merge are untouched.
- **Docs.** Each goes in the same commit as the change it describes:
  - `DOCUMENTATION.md`: the settings, protocol events, refusals and views.
  - The `/guide` page: turning on Versus, naming sides, moving a team, and the Start quiz refusal.
  - `GLOSSARY.md` is already updated.

## Testing Decisions

- Test external behaviour only: what a room is sent and what a press or event is refused with, never internal caches or helper calls.
- **Gateway (main seam), backend Jest with the DB-backed real store.** Covers:
  - the settings validation and refusals
  - phone pick and switch, refused after start
  - late-join pick
  - admin move
  - Start quiz refused while a team has no side
  - Versus off clears picks
  - kick or depart drops the team from the side figures
  - side figures in the display, players and admin views
  - nothing sent with Versus off
  - socket-event authorization for the two new events

  Prior art: `set-player-count.spec`, `set-team-player-count.spec`, `jokers-setting.spec`, `leaderboard-board.spec`, `join-players.spec`, `socket-event-authorization.spec`.
- **Side standings module, shared types.** Edge cases:
  - averages with uneven team counts
  - a negative average floored to 0 for the share only
  - all zeros split evenly
  - a side with no counted teams
  - teams that left or didn't take part excluded
  - lead and tie
  - the prior split

  Prior art: `leaderboard-board.test.ts`, `leaderboard-reveal.test.ts`.
- **Session settings schema.** Name rules and the side count. Prior art: the existing session settings schema specs.
- **Frontend component tests, Vitest.** Covers:
  - display bar timing (prior split until the top rank, then current; no slide without a prior split)
  - row dots
  - lobby counts
  - the ended screen's winner and tie
  - the phone side picker, badge and highlighted segment
  - the `/control` roster side and move control

  Prior art: `completion-and-leaderboard.test.tsx`, `lobby.test.tsx`, `ended-moment.test.tsx`, the `/play` joker pick screen tests.
- Optional: one Playwright journey (a two-side night through to the ended screen), following `joker-night.spec`. It's local only and not required for done.

## Out of Scope

- Versus in quickfire quizzes.
- Recording a side or the winning side anywhere: session result, stats, team page, league, scoresheet, night brief.
- Remembering or pre-selecting a team's side across sessions.
- Colour pickers or custom side colours; more than four sides.
- Side-based scoring, power-ups, bonuses or showdowns. Sides only group existing points.
- Using player count to weight sides.
- Showing sides in the roster marquee.

## Further Notes

- **Accepted tradeoff:** when a team leaves mid-quiz, its side's average can jump either way. This is the same behaviour the leaderboard already has for teams that left.
- If a session's scores change after it has ended, the ended screen's winning side is recomputed, since nothing is stored.
- No ADR: everything stays inside the session and is cheap to reverse.
