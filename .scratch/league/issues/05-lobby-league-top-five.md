# 05: The big screen lobby shows the league's top 5

**What to build:** The display view on the lobby screen carries `leagueTop`: the name and top 5 rows of the session's league (if several, the one created most recently; if none, `null`). It updates when the session's leagues change in settings. The lobby screen shows it beside the roster without crowding the join details.

Parent spec: `.scratch/league/spec.md`

**Blocked by:** 02, 03

**Status:** done

- [x] Backend test: league selection (none, one, several), and a settings change updates it
- [x] Lobby renders the top 5 and nothing when `null`
- [x] `DOCUMENTATION.md` (snapshot) documents `leagueTop`
