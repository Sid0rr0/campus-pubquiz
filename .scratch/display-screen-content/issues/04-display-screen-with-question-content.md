# 04: The big screen draws a Display screen that carries its question

**What to build:** The display view sends a **Display screen** in place of the On-air screen. Its kinds are the On-air screen's plus `blank`.

- **Question screens carry their question.** `question`, `break_review` and `reveal` carry the question they draw (the reveal question trimmed to its closest-guess step, as today), and `locking` carries its lock deadline.
- **`/display` stops looking things up.** It draws those screens from what it is sent. Its lookups by id and its "draw nothing if missing" guards are gone.
- **A missing question is explicit.** When the projection can't resolve a question, it sends `blank`, which draws the same empty area as today, and logs it, so the big screen never goes silently blank.
- **The other kinds don't change yet:** they carry what the On-air screen carries today.
- **The admin room keeps the On-air screen unchanged,** so `/control`, the presenter preview and the round note rule don't move.

The big screen looks exactly as it does today.

Parent spec: `.scratch/display-screen-content/spec.md`

**Blocked by:** 03 (both reshape the display view)

**Status:** ready-for-agent

- [ ] The display view carries the Display screen and no longer carries the On-air screen. `screenKey` and the header are unchanged.
- [ ] `question`, `locking`, `break_review` and `reveal` carry their content. Content that moves into the Display screen isn't also sent elsewhere in the display view.
- [ ] `blank` is sent and logged when a question screen's content can't be resolved.
- [ ] `/display` switches on the Display screen with no lookup by id and no guard for missing content on these kinds.
- [ ] The admin view, the presenter preview and the round note rule still read the On-air screen and are unchanged.
- [ ] Screen projection specs:
  - one case per question screen kind, checking its content;
  - `blank` when a reveal or break review question can't be found.
- [ ] `/display` render tests for these kinds render from projected views. Tests that only checked a lookup move to the projection spec.
- [ ] GLOSSARY.md gains **Display screen**, as distinct from the On-air screen.
- [ ] Typecheck, lint and tests pass.
