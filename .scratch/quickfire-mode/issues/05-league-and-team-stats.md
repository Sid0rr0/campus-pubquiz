# 05: Quickfire nights out of leagues and team rankings, team directory filter

**What to build:** League tables skip quickfire sessions; Wins and Average placing leave quickfire nights out; the team directory hides quickfire-only teams unless asked.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** 02

**Status:** done

- [ ] League table skips any quickfire session in the league (migrated history).
- [ ] Team page, staff team page and team directory: Sessions played counts quickfire nights; Wins and Average placing don't.
- [ ] `GET /teams` takes a `showQuickfireOnly` flag (default false) that hides **quickfire-only teams** (glossary); spec covers no ended sessions, mixed, and all-quickfire teams.
- [ ] Team directory: unchecked "Show quickfire-only teams" checkbox beside the search, resets to page 1, not remembered.
- [ ] `DOCUMENTATION.md` (leagues, team stats) updated.
