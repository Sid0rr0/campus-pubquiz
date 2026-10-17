# 02: Reveal clip, one video at reveal

**What to build:** A **reveal clip** (`revealStartSeconds`/`revealEndSeconds`) on any question whose media or answer media is a YouTube link. It goes through the draft, the preview schema, the stored payload, the question views and the CSV notes group (`revealStart`/`revealEnd`).

- **Editor:** two inputs, labelled "Answer video clip" when `answer_media_url` is a YouTube link, otherwise "Reveal clip (question video)".
- **At reveal:**
  - with a YouTube answer media, that video **replaces** the question video, clipped by the reveal clip
  - otherwise the question video plays again, clipped by the reveal clip
  - empty reveal start/end means the whole video

Today a YouTube answer media plays unclipped beside the question iframe (`AnswerMedia` in `apps/frontend/app/display/question-display.tsx`). That goes away.

Parent spec: `.scratch/youtube-clips/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Field round-trips: editor → save → load, and CSV import → export → import
- [ ] Display test: YouTube answer media at reveal leaves exactly one iframe, the answer one, with `start`/`end` from the reveal clip
- [ ] Display test: no answer media, reveal clip set → the question iframe's src carries the reveal clip, not the question clip
- [ ] Display test: no answer media, reveal clip empty → the question iframe plays with no start/end
- [ ] The question clip still applies while the question is asked
- [ ] `DOCUMENTATION.md` covers the reveal clip and which video it applies to; `/guide` describes the inputs
