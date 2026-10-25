# 02: Session rating tile, and drop the Fastest answer / Fastest team tiles

**What to build:** On `/stats/:id`, add a **Rating** tile ("★ 4.2", detail "37 ratings": the mean of every round rating in the session, "—" when none, "Feedback was off" when off). Remove the "Fastest answer" and "Fastest team" tiles, along with `pickFastestAnswer`, `pickFastestTeam`, the `fastestAnswer` / `fastestTeam` highlight fields, their types and their tests.

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** —

**Status:** done

- [x] Backend: session rating on the session detail, a mean of ratings rather than of round averages, no team data
- [x] Shared types: highlight fields and fastest types removed
- [x] Frontend: the Rating tile and its states; the two tiles gone
- [x] `DOCUMENTATION.md` (Session Stats) updated

**Notes for ticket 03:** the rating sits on `SessionDetailFeedback.rating` (null when off or unrated), built by `computeSessionFeedback({ isCollected, rows, roundRatings })` in `apps/backend/src/stats/session-feedback.calc.ts`. On the page, `FeedbackTiles` in `apps/frontend/app/stats/[id]/highlight-tiles.tsx` maps a list of tile props (today just `ratingTile`) and swaps each value for "Feedback was off" when `collected` is false; add the Pacing and Felt difficulty tiles to that list.
