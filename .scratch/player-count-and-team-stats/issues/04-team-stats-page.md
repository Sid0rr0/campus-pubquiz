# 04: Team stats page

**What to build:** A new staff page at `/teams/[id]` shows one team's history across every ended session it played. It's open to admins and moderators, like the rest of stats. Team names in the `/teams` directory and in a session's `/stats/[id]` standings table link to it.

Its tiles show:
- sessions played
- wins
- podiums (top three)
- best **placing**
- **average placing**, to one decimal
- average share of the max points, as a percentage
- average total points
- average player count

Below the tiles is a sortable, paginated sessions table, newest first. Each row has the date, the session name (linking to `/stats/[id]`), the placing ("4th of 12", or "Joint 2nd" for a tie), total points, share of max points, correct answers and player count.

Only ended sessions count. A session the team was kicked from or left is still listed (as "left") and counted in sessions played, but it is left out of wins, podiums, best placing and average placing. A team with no ended sessions sees a clear empty state rather than zeros, and an unknown team id shows a "not found" message. The page never shows the team's feedback (round ratings, comments, topic suggestions), because feedback stays anonymous. It never shows the team code either.

A new team detail endpoint, with the same guards as the stats endpoints, returns a 404 for an unknown team. It returns:
- the team's id and name
- the summary above:
  - a win means placing 1 and being the session's single winner, matching the standings winner
  - share of max points is averaged per session (each session's total ÷ its max points), not pooled
  - average player count leaves out sessions with no count, and is `null` when there are none
- one row per ended session: session id, name, played at, placing and placing-to (`null` when left), team count, `hasLeft`, total points, max points, correct answers and player count

Placings and departed teams come from the existing Standings service for each session, never from ranks recomputed in SQL, so the team page always agrees with each session's standings table.

Parent spec: `.scratch/player-count-and-team-stats/spec.md`

**Blocked by:** 01 (Teams report their player count), for the player count column and tile

**Status:** ready-for-agent

- [ ] Team service on real Postgres: only ended sessions count; a left session is listed with `hasLeft` but excluded from wins, podiums, best and average placing; a tie counts at its shared placing
- [ ] Team service: share of max points is averaged per session; average player count leaves out unknown counts; a team with no sessions gives an empty sessions list and `null` averages
- [ ] Team service: the response contains no feedback and no team code
- [ ] Controller: an unknown team gives a 404 and a bad id is rejected
- [ ] `/teams/[id]`: the tiles and sessions table render, with "left" rows, "Joint 2nd" ties and session links, plus the empty and not-found states
- [ ] Team names in the `/teams` directory and in the `/stats/[id]` standings table link to `/teams/[id]`
- [ ] `DOCUMENTATION.md` adds the route to the routes table and documents the endpoint
