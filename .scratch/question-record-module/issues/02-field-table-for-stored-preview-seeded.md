# 02: The Question record codec copies fields through one field table

**What to build:** The Question record codec decides, from one field table, when a question carries each field:

- always;
- when set;
- when its answer kind uses it;
- when its registry entry lists it as a grading setting;
- when the question media is a video;
- when either media is a video.

Stored row → preview, preview → stored fields and stored row → seeded question all copy through that table. A session's copy of a question now gets the same clip check as the save. It also exposes a media fields query: given a question's media link, answer media link and candidate clip fields, the clip fields a preview carries. Ticket 05 uses it in the editor.

Users see no change: stored questions already satisfy the save's rule, so every session copy comes out as today.

Parent spec: `.scratch/question-record-module/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] One field table, internal to the codec, lists each payload and preview field with its condition. Grading settings refer to the registry's list for the type rather than copying it.
- [ ] Stored row → preview, preview → stored fields and stored row → seeded question copy media, clip and grading setting fields only through the table. None of them names such a field outside it.
- [ ] The clip and the hidden-video flag are carried only for a video question media; the reveal clip when either the question media or the answer media is a video. This applies to every conversion, the seeded question included.
- [ ] A clip group left in notes by an older save is still read, merged under the payload fields and stripped.
- [ ] The codec exposes the media fields query and stays pure.
- [ ] A table-driven round-trip spec runs over every question type crossed with every media kind: none, image, sound, YouTube, video file, and an image question with an answer video.
  - preview → stored → preview gives the same preview;
  - stored → seeded carries the same media, clip and grading setting fields and never an answer from the payload;
  - a field the type or media doesn't allow is absent from every output.
- [ ] Overlapping cases in the existing codec test are replaced by the table-driven spec. Cases that test something the table doesn't, such as legacy notes, stay.
- [ ] Typecheck, lint and tests pass.
