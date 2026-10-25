# 04: Average response time per round

**What to build:** Add `avgResponseMs: number | null` to `SessionDetailRoundRow`, the mean `responseMs` over the round's answers that have one. Show it as an **Avg. response** column on the `/stats/:id` rounds table via `formatResponseMs` ("Not recorded" when null).

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Backend: the mean per round, and null when no answer has a recorded time
- [ ] Frontend: the column, with "Not recorded"
- [ ] `DOCUMENTATION.md`: the column, with the caveat that in normal blocks the time runs to a team's last edit
