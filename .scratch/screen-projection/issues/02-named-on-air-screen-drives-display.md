# 02: Named on-air screen drives the big screen

**What to build:** The display view names the screen on air: lobby, rules, round overview, round title, question, locking, break intro, break review, break round title, reveal intro, reveal, leaderboard, ended or showdown. With it comes the question or round that screen is about, resolved once while the round index stays pinned during break and reveal. The view also says whether the between-kahoot-questions leaderboard is showing, using ticket 01's rule. /display takes its transition key, header content and between-kahoot animation flag from the view, and stops computing them itself. Nothing visible on the big screen changes. See the spec ([spec](../spec.md)).

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The projection computes the named screen as a discriminated value (screen kind plus its question or round), included in the display and admin views.
- [ ] The display view carries a transition key that changes only when what's on screen changes, matching today's keys, including the closest_guess reveal step and the showdown step.
- [ ] The display view carries the header's label, title and badge. In break review and reveal they match the round of the question on screen.
- [ ] The display view carries a between-kahoot-questions flag built on the shared hidden-behind-leaderboard rule.
- [ ] /display's own screen-key, header and between-kahoot derivations are deleted. It renders from the view.
- [ ] Projection tests walk a whole quiz (normal block, kahoot round, closest_guess reveal, showdown, and Previous back through break and reveal) and assert the named screen and its question or round at each step.
- [ ] The display page tests pass on per-audience view fixtures, and the display's previous-leaderboard animation capture stays local page state.
