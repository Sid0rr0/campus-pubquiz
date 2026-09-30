# 06: Align half points and sort comparison

**What to build:** The quiz master's "Half" quick-grade button awards the Scoring module's half points (rounded, matching match all-or-nothing's half credit), so 3 points gives 2, not 1.5. Sort answers are compared with the same tolerance as match (surrounding whitespace and empty items ignored), so a formatting quirk doesn't cost a team a sort question. See [spec](../spec.md) user stories 6 and 19.

**Blocked by:** 01

**Status:** ready-for-agent

- [x] Frontend test: the Half button's label and awarded value use the shared rule for odd and even question points.
- [x] Scoring table tests: sort answers differing only by surrounding whitespace or empty items score as correct, and a genuinely different order still scores zero.
- [x] Postgres test: submitting such a sort answer stores full points.

## Comments

Implemented in `feat(frontend,shared-types): align half points and sort comparison`. Status line left as `ready-for-agent`; the triage vocabulary has no done state.

- The Half button uses `halfPoints` from Scoring (3 points → 2). Sort compares `splitPipeList`-normalised lists; multiple_choice stays exact.
- Covered by new table rows in `scoring.test.ts`, an `answers-panel.test.tsx` case over odd/even points, and a Postgres case in `auto-grading.spec.ts`.
