# 02: Directory Sessions played matches the team page

**What to build:** On the `/teams` directory, a team's **Sessions played** equals the Sessions played on that team's own page. Today the directory counts the team's roster rows. That counts a lobby the team is sitting in, or a night still running, and misses nights the team was kicked from or left after answering or receiving a bonus. After this ticket, the directory counts the ended sessions the team took part in. Sorting the directory by Sessions played orders teams by that same number.

The Ended-sessions read gains a "sessions played per team" query (team id plus a count of ended sessions taken part in) that the directory can join, sort by and page in SQL. The directory's roster-row count is deleted. The wire field and sort key keep the name `sessionsJoined`, so the frontend and the sort query don't change. Only the shared type's comment changes, to say what is counted.

See the spec's "Readers → Team directory" and "Docs, in the same change".

**Blocked by:** 01 (Ended-sessions read owns "took part")

**Status:** done

- [ ] A team kicked from an ended night after answering, or after receiving a bonus award, has that night counted in the directory's Sessions played.
- [ ] A team on the roster of a lobby or running session doesn't have it counted until it ends.
- [ ] A team with no ended nights shows 0 and sorts with the other zeros.
- [ ] Sorting by Sessions played follows the shown number, with paging still done in SQL.
- [ ] Adapter spec cases: sessions played per team counts kicked and departed nights, leaves out lobby and running sessions, and gives 0 to a team with none.
- [ ] A team directory service spec case seeds a kicked team and a team in a lobby, and checks that the directory's Sessions played equals the team history summary's `sessionsPlayed` for each.
- [ ] Team directory spec cases that pinned the roster-row count are rewritten to the new rule.
- [ ] GLOSSARY.md adds **Took part** and **Sessions played**.
- [ ] DOCUMENTATION.md: the team directory paragraph says Sessions played counts ended sessions the team took part in and equals the team page's `sessionsPlayed`. The team page section points at **Took part** instead of restating the rule.
- [ ] `pnpm typecheck`, `pnpm lint` and the backend tests pass.
