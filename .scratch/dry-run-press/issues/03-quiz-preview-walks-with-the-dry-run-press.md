# 03: The Quiz preview walks with the shared dry-run press

**What to build:** The Quiz preview's "like the night" order is walked by the same dry-run press as /remote's "next" line, including the real Settle step, instead of its own hand-written press, which is deleted. A quiz author sees exactly the same preview as before, in both orders. The preview can no longer drift from what pressing Advance does live.

See the spec's "The Quiz preview walks with it" section.

Parent spec: `.scratch/dry-run-press/spec.md`

**Blocked by:** 01, 02

**Status:** ready-for-agent

- [ ] The walk presses the Move plan's next press (Start quiz in the lobby, Advance everywhere else) through the shared dry-run press, with a fixed time.
- [ ] The walk stops at the end of the quiz, or on any step that doesn't move the quiz.
- [ ] The Quiz preview's hand-written press is deleted. No copy of the press is left in the Quiz preview module or its tests.
- [ ] These are unchanged:
  - the kept screen kinds;
  - the renumbering around rounds with no questions;
  - the break intro's empty deadline, feedback prompt and fun facts;
  - host-only text;
  - the `answer_after_question` order.
- [ ] The real-session spec from ticket 01 and every remaining shared Quiz preview case pass unchanged.
- [ ] Docs, in the same change:
  - GLOSSARY.md's **Commit a move** says the presenter preview and the Quiz preview's "like the night" order are both dry-run commits through the same dry-run press;
  - GLOSSARY.md's **Quiz preview** says its "like the night" order is walked by it;
  - DOCUMENTATION.md's Quiz preview `night` paragraph says the order is a dry run of the real press (Move plan and Settle step) over the team-less session.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once.
