# 03: League table builds its nights from the Session result

**What to build:** The league table, the league position on the team page and the lobby's league top five keep showing exactly what they show today. They now get each team night from the Session result (placing, answered, night won) rather than from the league's own "answered" query and its own leaderboard/departed lookup. A night won now means the same thing in the league and on the team page because both read one field, and a spec proves they agree.

Parent spec: `.scratch/session-result-module/spec.md`

**Blocked by:** 02

**Status:** done

- [ ] The league builds team nights from the Standings results read. The league's separate "answered" query and its leaderboard/departed lookup are deleted.
- [ ] The league table counts nights won from `wonNight`, and its average placing uses the shared average placing over the nights that count towards the league (the team answered at least one question).
- [ ] League points, the tie-break order (points, then nights won, then unrounded average placing, then name) and the shared positions do not change. The existing league table calc and service specs pass with only fixture-shape updates.
- [ ] A pure cross-reader spec feeds one set of nights to both the league night builder and the team history summary, and checks that nights won, wins and placings agree, including a tie for first and a team that left.
- [ ] Docs, in the same change, in GLOSSARY.md:
  - **Average placing** says the league's version covers only the nights that count towards the league;
  - **League table** points at **Night won**.
- [ ] Typecheck, lint and tests pass.
