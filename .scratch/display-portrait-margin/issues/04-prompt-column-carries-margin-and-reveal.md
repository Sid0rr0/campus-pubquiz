# 04: The prompt column carries the margin and the reveal

**What to build:** A question's text content travels with its prompt. The margin sits directly under the prompt in every layout (two-column, stacked with a landscape image or video, and no media). At reveal in the two-column layout, the answer line and any choice/sort/match list sit in the left column under the prompt, and an answer image, when set, replaces the question image in the right column whatever its shape. Prefactor first: make the prompt and its text content one block that both the two-column and stacked layouts render.

Parent spec: `.scratch/display-portrait-margin/spec.md`

**Blocked by:** 03 (same layout code)

**Status:** done

- [x] Two-column, asked: the margin renders inside the prompt column (question-display tests faking a portrait load).
- [x] Two-column, reveal: the answer line and choice/sort/match content render inside the prompt column.
- [x] Two-column reveal with an answer image: the answer image takes the image column; the question image is not shown.
- [x] Stacked layouts: the margin renders right after the prompt, before the media.
- [x] The phone's question views still render correctly (it has no media, so stacked).
- [ ] Checked by hand on :8888 `/display` with the screenshot's Sagrada Família question, asked and revealed.
