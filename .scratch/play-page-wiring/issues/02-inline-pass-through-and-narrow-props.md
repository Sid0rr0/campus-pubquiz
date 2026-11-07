# 02: Inline the pass-through helpers and narrow the props

**What to build:** The play page reads as plain wiring: helpers that only pass values along are gone, and each component's props say what it reads instead of taking whole hook results. Teams see no change.

Parent spec: `.scratch/play-page-wiring/spec.md`

**Blocked by:** 01 (Measure the page, and move the joker derivations out); skip it if 01 closed as `wontfix`

**Status:** ready-for-agent

- [ ] Each helper 01 marked pass-through (expected: the power-ups card's props and the side panels) is inlined where its panel renders; one whose inlining puts a function over the CRAP limit of 10 stays, with a narrow interface instead.
- [ ] Page components take the fields and callbacks they use, not whole results of the question browser, saved-confirmation or power-up moment hooks or the opened questions. A small named type for values that always travel together is fine; a type that only renames a hook's return is not.
- [ ] The question browser's props shrink only where the blocking specs collapsed several into one (for example the doubled-rounds and joker-question values into one joker marks value).
- [ ] No component moves to its own file unless it gains its own test.
- [ ] The 26 page-level test files pass unchanged.
- [ ] `pnpm crap:changed` passes.
