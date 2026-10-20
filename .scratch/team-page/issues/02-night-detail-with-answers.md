# 02: A night's questions with our answers and the right ones

**What to build:** `POST /team-page/sessions/:sessionId` `{ teamCode }` returns, for an ended session the team was on the roster of, every question in order with round title, number, text, type, the team's answer (or none), verdict, points earned, the question's points and the correct answer. Otherwise 404. The team page links each listed session to this view.

Parent spec: `.scratch/team-page/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Real-Postgres test: the team's own answers only; a session not yet ended → 404; a session the team never joined → 404; a kicked team still sees its answers
- [x] Answers render by answer kind (text, number, choice, order, pairs) and a missing answer reads "No answer"
- [x] `DOCUMENTATION.md` updated
