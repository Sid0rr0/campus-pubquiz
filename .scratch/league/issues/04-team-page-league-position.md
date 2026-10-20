# 04: League position on the team page

**What to build:** The team page response gains, for each current league, the team's position, the number of teams and its points, and the page shows "3rd of 18 · 14 pts" per league. A league where the team has no points is omitted.

Parent spec: `.scratch/league/spec.md`

**Blocked by:** 03

**Status:** done

- [x] Real-Postgres test: positions match the public table; shared positions read "Joint 3rd"; leagues that aren't current are omitted
- [x] Page renders zero, one or several leagues
