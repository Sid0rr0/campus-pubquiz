# 02: The phone and the answers list answer by answer kind

**What to build:** A team's phone shows the right way to answer for every question, by the same rule the big screen and editor use. Every answer is stored and read back through its answer format, so the phone, `/control`'s answers list and the team's own answer list show the same thing. Today the phone's answer form decides by itself whether an audio or YouTube question answers from choices, and the sort and match inputs join their items by hand.

The phone's answer input becomes a map with an entry for every answer kind: typed text, number, choice (with the kahoot one-tap behaviour), sort and match. Each entry restores a submitted answer through the format's decode and submits through its encode. The answer form renders the entry for the question's answer kind, and "I don't know" stays available as today. The shared answer formatter uses the answer formats instead of its own branches.

Parent spec: `.scratch/question-answer-kinds/spec.md`

**Blocked by:** 01

**Status:** done

- [x] An audio question with choices shows them as choices on the phone, and an audio question whose choices are all blank shows a text box, both by the answer kind resolver.
- [x] A sort and a match answer submit the same stored string as today and restore after a reconnect in the order the team left them.
- [x] The kahoot one-tap choice behaviour and "I don't know" are unchanged.
- [x] `/control`'s answers list and the team's own answer list show match answers as "left → right" pairs and sort answers as an arrow chain, through the answer formats.
- [x] Nothing on the phone or in the answer formatter branches on sort, match or choices outside the answer-kind map.
- [x] The phone's free-text-and-multiple-choice, sort-and-match and break-and-reveal tests, and the answer formatter tests, pass, with added audio cases with and without choices.
