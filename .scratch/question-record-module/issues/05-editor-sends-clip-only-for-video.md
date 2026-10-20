# 05: The quiz editor sends a clip only for a video

**What to build:** In the quiz editor, a clip typed while the question's media is a video is saved with it. If the author then switches the media to an image or a sound, the clip and the hidden-video flag are not sent with the save: the editor asks the Question record codec which clip fields a preview carries instead of deciding for itself. The typed times stay in the form, so switching back to a video before saving keeps them. The reveal clip is sent when either the question media or the answer media is a video, as today. The editor's default margin and match scoring mode are written in one place, not in both the new-question and load paths.

Parent spec: `.scratch/question-record-module/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] The editor's draft → preview conversion takes its clip, hidden-video and reveal clip fields from the codec's media fields query. The editor holds no "is this a video" rule of its own.
- [ ] A draft with typed clip times and image or sound media sends no clip and no hidden-video flag, and its typed times are unchanged in the draft.
- [ ] The default margin and match scoring mode for a new or loaded question are each defined once.
- [ ] A frontend round-trip spec takes each question type through draft → preview → stored fields (the real codec) → preview → draft and checks the draft comes back unchanged. It includes the image-with-typed-clip case.
- [ ] Existing editor draft tests whose fixtures assumed a clip on non-video media are updated, not deleted.
- [ ] DOCUMENTATION.md's editor section says clip times are saved only for a video question media.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once before the PR (the CSV round-trip and editor create-and-play journeys cross these paths).
