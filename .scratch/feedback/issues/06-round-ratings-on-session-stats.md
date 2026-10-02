# 06: Round ratings on the session stats page

**What to build:** On a played session's stats page, the rounds table gains a Rating column: "★ 4.2 · 9 teams" for a rated round, or "—" when no team rated it. Ratings are anonymous: nothing on the page or in the API says which team gave which rating.

The session detail stats gain, per round, `rating: { average, count } | null`, computed per request from the round ratings.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Written first, failing against today's code: the stats service returns each round's average and count, and `null` for an unrated round.
- [x] The response carries no team id or name for any rating.
- [x] Stats page: the Rating column shows "★ 4.2 · 9 teams" and "—".
- [x] `DOCUMENTATION.md`'s stats section mentions the rating.
