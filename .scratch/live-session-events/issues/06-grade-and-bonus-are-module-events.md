# 06: Grade answer and award bonus are module events

**What to build:** Two admin actions become events in the Live session module:

- **Grading an answer by hand.** The module grades through the answer service, then runs the answer-change refresh for that answer's question.
- **Awarding a bonus over the socket.** The module reads the session's own enabled categories and per-category limit, awards the bonus, then runs the existing bonus-changed refresh with the team's notice.

Invalid grades and invalid bonus awards become module refusals. Both handlers become one-line adapters. The REST bonus routes are not touched.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A manual grade refreshes the leaderboard, the ungraded markers and that question's admin answer list.
- [ ] An invalid grade is refused with today's message.
- [ ] A bonus in a disabled category, or over the per-category limit, is refused with today's message.
- [ ] A connected team gets the bonus notice, and the leaderboard refreshes.
