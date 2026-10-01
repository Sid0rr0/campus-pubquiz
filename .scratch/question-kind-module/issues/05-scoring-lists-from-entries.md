# 05: Scoring lists derive from entries, and closest_guess literals go

**What to build:** The Scoring module's per-type lists (auto-graded, batch-graded, human-graded, kahoot-allowed, overridable) and their helper predicates are derived from entry fields, with the same names and results, so callers don't change. Block grading and the answers panel ask the entry for its grading mode instead of comparing against the literal `closest_guess`.

Kahoot-allowed stays its own field on each entry and is never derived from auto-graded (ADR 0001).

**Blocked by:** 01 (Registry skeleton with parity and characterization table).

**Status:** ready-for-agent

- [ ] The five per-type lists and their predicates are derived from entry fields and keep their public names and results
- [ ] No `closest_guess` literal comparison remains in block grading or the answers panel
- [ ] kahootAllowed is an independent entry field: free_text is auto-graded and not kahoot-allowed
- [ ] The existing scoring, grading and answers-panel specs pass unchanged
- [ ] The per-type flag assertions from ticket 01 still pass
