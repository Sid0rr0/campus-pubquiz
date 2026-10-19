# Spec: Portrait question images that fit, and a margin that explains itself

Status: ready-for-agent

Blocked by: none

Source: request 2026-10-19 (screenshot of a portrait Sagrada Família image overflowing the `/display` header, with "within 5%" floating bottom-centre).

## Problem Statement

On the big screen, a question with a portrait image switches to the two-column layout (prompt left, image right), but the image renders at its natural size: it runs up over the header and off the bottom of the screen. At reveal the answer line appears centred under the whole row instead of under the prompt it answers. A Number question's margin floats separately at the bottom ("within 5%") and doesn't say what it's 5% *of*, so teams new to the format don't know how close they need to be. The quiz master setting the margin in the quiz form can't see what answers it will actually accept.

## Solution

- A portrait question image is capped to the space between the header and the "X OF Y TEAMS ANSWERED" line, keeping the 50/50 split.
- In the two-column layout everything textual — the margin while asked; the answer line and any choice/sort/match list at reveal — sits in the left column under the prompt. An answer image, when set, takes the right column in place of the question image, whatever its shape.
- The margin sits directly under the prompt in every layout, worded as a sentence: "Answers within 5% of the real number count as correct" (absolute: "Answers within 5 of the real number count as correct"; margin 0: "Exact answer only"). The reveal line reads "200 (anything from 180 to 220 counts)" (margin 0: just "200").
- The quiz form shows the live **accepted range** next to the margin setting: "Accepts 180–220", or "Accepts only 200" for a margin of 0, or "Enter the answer to see the accepted range" while the answer isn't a number.

## User Stories

1. As a team at the venue, I want a portrait question image to fit on the big screen, so that I can see the whole picture without it covering the header.
2. As a team, I want the round and question number in the header to stay visible on a portrait image question, so that I know where we are in the quiz.
3. As a team, I want the "X OF Y TEAMS ANSWERED" line to stay visible on a portrait image question, so that I know whether we're the last to answer.
4. As a team, I want the margin shown right under the question, so that I read it as part of what's being asked.
5. As a team, I want the margin worded as a sentence ("Answers within 5% of the real number count as correct"), so that I understand how close our guess must be.
6. As a team, I want an absolute margin worded the same way without a percent sign, so that I know it's a fixed distance.
7. As a team, I want a margin of 0 to say "Exact answer only", so that I'm not confused by "within 0".
8. As a team on my phone, I want the same margin sentence as the big screen, so that both say the same thing.
9. As a team at reveal, I want the answer to appear under the question on the left when there's a portrait image, so that the answer reads as the question's continuation.
10. As a team at reveal, I want the reveal line to say "200 (anything from 180 to 220 counts)", so that I can tell instantly whether our guess scored.
11. As a team at reveal on a margin-0 question, I want just the key shown, so that there's no meaningless range.
12. As a team at reveal of a choice question with a portrait image, I want the option list with the correct one highlighted under the question on the left, so that the image doesn't push it off screen.
13. As a team at reveal of a sort or match question with a portrait image, I want the answer lists under the question on the left, for the same reason.
14. As a team at reveal of a question with an answer image, I want the answer image in the right column in place of the question image, so that the layout doesn't jump at reveal.
15. As a team, I want a landscape image, video or no-media question to keep its current stacked layout, with the margin moved up under the prompt, so that nothing else changes.
16. As the quiz master in the quiz form, I want to see the accepted range next to the margin setting, so that I know which answers will count as correct.
17. As the quiz master, I want the accepted range to update as I change the answer, the margin value or the unit, so that I can tune it live.
18. As the quiz master, I want "Accepts only 200" for a margin of 0, so that the exact-answer case is obvious.
19. As the quiz master, I want a prompt to enter the answer when it's empty or not a number, so that I know why no range shows.
20. As the quiz master in fullscreen media mode (spacebar), I want the portrait image to still fill the screen as before, so that fullscreen is unaffected.

## Implementation Decisions

- **Margin wording lives in the shared margin formatters** (`shared/types`): the open-question text, the reveal line, and a new form hint built on the existing accepted-range helper. Both big screen and phone keep reading one formatter, so wording never drifts. The formatter's existing 2-decimal display rule stays; grading still uses the exact range.
- **Margin 0** gets its own wording in all three places: "Exact answer only" (asked), the bare key (reveal), "Accepts only <key>" (form).
- **QuestionDisplay layout:** the prompt and its text content (the question body — margin, choice options, sort/match lists — and the reveal lead/body) become one prompt block. The two-column layout puts the prompt block on the left and the media (question image, or answer image at reveal) on the right; the stacked layout renders the same prompt block, then media. This replaces today's arrangement where the margin and reveal content are siblings rendered after the media row.
- **Image fit:** the two-column row and its image column get a definite height bounded by the screen area between header and footer, so the image's max-height caps it. The split stays 50/50.
- **Answer image in two-column:** when revealing a portrait-image question that has an answer image, the answer image replaces the question image in the right column regardless of the answer image's orientation. The existing side-by-side reveal (question image + answer image) does not apply in the two-column layout.
- **Quiz form:** the margin row replaces its fixed "0 accepts only the exact answer" hint with the live accepted-range hint, computed from the draft answer and margin.
- Glossary: **Margin** and **Accepted range** are already defined; use them.

## Testing Decisions

- Test external behaviour only: rendered text and where it renders, not class names or internal structure.
- **Margin formatters**: pure unit tests alongside the existing margin text tests — percent, absolute, decimals, margin 0, reveal line, form hint (range, margin 0, non-numeric answer).
- **QuestionDisplay**: render tests in the existing question-display tests, which already fake a portrait image load via `naturalWidth`/`naturalHeight`. Assert the margin and reveal content are inside the prompt column in two-column layout, the answer image takes the image column, and stacked layouts put the margin right after the prompt.
- **Quiz form**: the existing quiz editor panel tests — the hint follows the answer, margin value and unit inputs.
- **Image fit** depends on real CSS layout, which happy-dom doesn't compute: verified by hand on the running app (:8888 `/display`) with a tall portrait image and a long prompt. No new e2e journey.
- Existing phone tests asserting the old "within 10%" text are updated to the new wording.

## Out of Scope

- Changing the 50/50 split or making portrait images narrower.
- A margin column in CSV import/export.
- Closest-guess (no margin) wording.
- Landscape image sizing.

## Further Notes

- The glossary avoids "tolerance"; the request used it to mean **Margin**.
- DOCUMENTATION.md's Number question section quotes the old wording and must be updated with ticket 01. The `/guide` page only if it quotes these lines.
