# 03: Grades and bonus awards land inside the write

**What to build:** A grade the quiz master gives, or a bonus they award, lands in one clear order against presses, answer-key fixes and other grades. The ungraded markers and the leaderboard always match what was stored. Today grading an answer and storing a bonus award both write to the database before the session write, and the bonus limits are read from the stored session.

Grade answer grades the answer and runs the grading refresh inside one session write, using the answer-refresh helper from ticket 01. Award bonus reads the session's enabled bonus categories and per-category limit from the session the write holds, stores the award, and builds the BONUS_AWARDED notice inside one write. The shared bonus-changed step becomes a private helper that builds the change. Refusals keep their messages.

Parent spec: `.scratch/team-event-gates/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] A grade sent while a press out of the break is held lands in one order. Either it's graded before the press, which then goes ahead, or the press is refused for an ungraded answer and the grade lands after. `/control`'s ungraded markers match the stored grades either way.
- [ ] A grade that the answer module refuses (an unknown answer, a closest_guess answer) stores nothing and still reports its message.
- [ ] A bonus award over the per-category limit is refused with the existing message and stores nothing.
- [ ] `grading.spec.ts`, `award-bonus.spec.ts`, `bonus-changed.spec.ts` and `live-edit-regrade.spec.ts` pass unchanged.
