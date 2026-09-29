# 06: Align half points and sort comparison

**What to build:** The quiz master's "Half" quick-grade button awards the Scoring module's half points (rounded, matching match all-or-nothing's half credit), so 3 points gives 2, not 1.5. Sort answers are compared with the same tolerance as match (surrounding whitespace and empty items ignored), so a formatting quirk doesn't cost a team a sort question. See [spec](../spec.md) user stories 6 and 19.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Frontend test: the Half button's label and awarded value use the shared rule for odd and even question points.
- [ ] Scoring table tests: sort answers differing only by surrounding whitespace or empty items score as correct, and a genuinely different order still scores zero.
- [ ] Postgres test: submitting such a sort answer stores full points.
