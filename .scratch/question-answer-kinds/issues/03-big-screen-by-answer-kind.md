# 03: The big screen asks and reveals by answer kind

**What to build:** The big screen shows choices, sort items and match columns while asking, and the correct answer (and, when given, a team's own answer laid out the same way) at reveal, by the question's answer kind. An audio or YouTube question shows choices exactly when the phone does. Today the question display works out sort, match and choices for itself three times: asking, revealing, and a team's own answer at reveal.

The big screen gets two maps, each with an entry for every answer kind: a question body for asking, and a reveal body for the correct answer and a team's own answer. Stored answers are read through the answer formats. The question display renders the entries for the question's answer kind. Media handling (images, audio, YouTube clips, side-by-side answer media) is untouched.

Parent spec: `.scratch/question-answer-kinds/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] While asking, the big screen shows the same choices, sort items and match columns as today for every question type.
- [ ] At reveal, the correct sort order, match pairs and correct choice look the same as today, and a team's own sort or match answer is laid out like the correct one.
- [ ] An audio question with choices shows them on the big screen, and one whose choices are all blank doesn't, matching the phone.
- [ ] Nothing in the question display branches on sort, match or choices outside the answer-kind maps.
- [ ] The big screen's question display, reveal and media rendering tests pass, with added audio cases with and without choices.
