# 02: Two columns: question detail beside the browser, grading list below

**What to build:** The `/control` main area becomes two columns: the question browser on the left and a detail column on the right. The detail column shows the selected question (today's selection rules: the on-air question, a clicked question until the big screen reaches it, else the block's first question): the round line (round number, round title, question number), the prompt, the correct answer, the Question notes, and the question's options. Multiple choice lists its choices with the correct one(s) highlighted; sort lists its items; match lists its left items and match targets; types without options show no options section. The grading list (correct count and per-team rows) moves out from under the question header and sits full width below the two columns, above Teams. Below the `md` breakpoint the columns stack.

**Blocked by:** 01 (both edit the page row that holds the browser and the timer)

**Status:** ready-for-agent

- [ ] Detail column beside the browser shows round line, prompt, correct answer, notes
- [ ] Options shown per type as above, preferring what the question type registry or existing answer formatting already exposes over a new per-type switch
- [ ] The answers panel no longer draws the question header; the grading list is full width below both columns
- [ ] Selection, snap-back and fallback behave exactly as today (question-only)
- [ ] `/control` page tests cover the detail column and options per type; old answers-panel header assertions updated
- [ ] Guide text for this change goes to ticket 05
