# 05: Sort, match, number and closest guess on a phone

**What to build:** A journey on a small CSV with one `sort`, `match`, `number` and `closest_guess` question. A touch-emulated phone enters each answer, `/control` sees it, and the reveal shows it. Includes the `closest_guess` step-by-step reveal on the big screen.

Wiring only: no partial-credit or margin cases (those stay in the real-store specs).

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Each type can be answered on the phone with touch input.
- [ ] Each type's reveal shows the team's answer and the key.
- [ ] The closest-guess reveal move is recorded.
- [ ] Passes `--repeat-each=5`.
