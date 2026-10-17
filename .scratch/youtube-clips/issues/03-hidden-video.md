# 03: Hidden video

**What to build:** A "Hide video (sound only)" checkbox (`isVideoHidden`) on any question whose media URL is a YouTube link. It goes through the draft, the preview schema, the stored payload, the question views and the CSV notes group (`hideVideo: true`).

- **Big screen:** the question's iframe stays mounted at full size, covered by an opaque panel with a 🎵 label. The panel sits in the same tree, so toggling it never remounts the player. The video is covered while the question is asked and in break review, and uncovered at reveal.
- **Phones:** "🎧 Listen" replaces "👀 Look at the screen" for a hidden video (`apps/frontend/app/play/question-browser.tsx`).

Parent spec: `.scratch/youtube-clips/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Field round-trips: editor → save → load, and CSV import → export → import; a stored payload without the field reads as not hidden
- [ ] Display test: covered in question view and break review, uncovered at reveal, iframe present in all three
- [ ] Phone test: "🎧 Listen" when hidden, "👀 Look at the screen" otherwise
- [ ] Checkbox shown only for YouTube media
- [ ] `DOCUMENTATION.md` covers hidden video; `/guide` describes the checkbox
