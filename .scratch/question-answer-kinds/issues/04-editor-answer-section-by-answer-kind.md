# 04: The quiz editor's answer section by answer kind

**What to build:** The quiz editor offers the right answer fields for every question (a correct-answer text, choices with one marked correct, sort items in order, or match pairs) by the same answer kind rule the phone and big screen use. Saving and reopening a quiz keeps every answer exactly as it was. Today the editor's load step and save step each have their own rule for whether an audio or YouTube question answers from choices, and the save step joins sort and match answers by hand.

The editor's answer section becomes a map with an entry for every answer kind. Each entry holds its answer fields and converts that kind between the stored question and the editor's draft, through the answer formats. Loading and saving a question go through the answer kind resolver and the entry for that kind. A sort's display order and a match's target order are still kept as saved, so re-saving never reshuffles them.

Parent spec: `.scratch/question-answer-kinds/spec.md`

**Blocked by:** 01

**Status:** done

- [x] An audio question with choices loads with its choices and the correct one marked, and saves the same answer; one with no choices loads and saves its correct-answer text.
- [x] Clearing every choice's text on an audio question saves it as a typed-answer question, by the same rule the phone uses.
- [x] Saving and reopening keeps sort orders, match pairings and their saved display order.
- [x] Nothing in the editor's draft conversion or question editor branches on sort, match or choices outside the answer-kind map.
- [x] The quiz editor panel and draft state tests pass, with added audio cases with and without choices.
