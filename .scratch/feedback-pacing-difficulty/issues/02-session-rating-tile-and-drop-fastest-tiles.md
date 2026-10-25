# 02: Session rating tile, and drop the Fastest answer / Fastest team tiles

**What to build:** On `/stats/:id`, add a **Rating** tile ("★ 4.2", detail "37 ratings": the mean of every round rating in the session, "—" when none, "Feedback was off" when off). Remove the "Fastest answer" and "Fastest team" tiles, along with `pickFastestAnswer`, `pickFastestTeam`, the `fastestAnswer` / `fastestTeam` highlight fields, their types and their tests.

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Backend: session rating on the session detail, a mean of ratings rather than of round averages, no team data
- [ ] Shared types: highlight fields and fastest types removed
- [ ] Frontend: the Rating tile and its states; the two tiles gone
- [ ] `DOCUMENTATION.md` (Session Stats) updated
