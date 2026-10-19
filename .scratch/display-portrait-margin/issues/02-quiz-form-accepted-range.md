# 02: The quiz form shows the accepted range

**What to build:** Next to a Number question's margin setting in the quiz form, the quiz master sees the live accepted range: "Accepts 180–220", or "Accepts only 200" for a margin of 0. It updates as the answer, margin value or unit changes. While the answer is empty or not a number it reads "Enter the answer to see the accepted range". This replaces the fixed "0 accepts only the exact answer" hint.

Parent spec: `.scratch/display-portrait-margin/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The hint shows the accepted range for percent and absolute margins, using the shared accepted-range formatter.
- [ ] Margin 0 shows "Accepts only <key>".
- [ ] Empty or non-numeric answer shows the fallback prompt.
- [ ] Changing answer, margin value or unit updates the hint (quiz editor panel tests).
- [ ] The fixed hint is gone; the zero-key-with-percent warning still shows.
