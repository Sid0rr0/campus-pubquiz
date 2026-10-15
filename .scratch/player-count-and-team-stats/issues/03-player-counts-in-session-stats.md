# 03: Player counts in session stats

**What to build:** An ended session's stats page (`/stats/[id]`) shows a Total players tile with "n of m teams reported", an Avg. team size tile, and a Players column in the standings table. Teams with no count show "—" and are left out of the total and the average rather than counted as zero. A team that was kicked or left still shows its count and still adds to the total. The played-sessions list (`/stats`) gains a Players column. A session where no team gave a count, including every session played before this feature, shows "—".

The session detail response gains `playerCount: { total, average, reportedTeams }`. The total sums the known counts across every participant, departed teams included. `reportedTeams` is how many participants gave a count, and the average is total ÷ reportedTeams, `null` when nobody reported. Every standing row, departed rows included, gains `playerCount: number | null`. The played-sessions list items gain `totalPlayers: number | null`, `null` when nobody in the session reported.

Parent spec: `.scratch/player-count-and-team-stats/spec.md`

**Blocked by:** 01 (Teams report their player count)

**Status:** done

- [ ] Stats service on real Postgres: the total and average leave out unknown counts, `reportedTeams` is correct, a departed team's count is included, and the average is `null` when nobody reported
- [ ] Stats service: each standing row carries its count, departed rows included, and `null` when unknown
- [ ] Stats service: the played-sessions list's `totalPlayers` is correct, and `null` when nobody reported
- [ ] `/stats/[id]`: the Total players tile (with "n of m teams reported") and Avg. team size tile render, showing "—" when nobody reported; the standings table has a Players column showing "—" for unknown counts
- [ ] `/stats`: the list has a Players column showing "—" when nobody reported
- [ ] `DOCUMENTATION.md` documents the new stats fields
