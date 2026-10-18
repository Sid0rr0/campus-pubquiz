# 02: Clip, reveal clip and hidden video for video files

**What to build:** Everything that today switches on "is this YouTube?" to decide whether a clip, reveal clip or hidden video applies switches on "is this a video?" (`isVideoUrl` from 01), and `/display` applies them to a `<video>`.

- `question-record-codec.ts` `previewToStoredFields`: clip fields reach the payload for any video `media_url`.
- `question-row-schema.ts`: CSV decode (`clipPreviewFieldsOf`) and encode (`clipNotesFieldsOf`, `hasYoutubeMedia` → a video equivalent) treat a video file like YouTube, so the `{start, end, revealStart, revealEnd, hideVideo}` notes group round-trips.
- Quiz question editor: clip inputs and "Hide video (sound only)" appear for a video file `media_url`; the reveal pair appears for either video and is labelled "Answer video clip" when `answer_media_url` is a video.
- `/display`: clips via a media fragment on the src (`#t=start,end`, either bound optional); question clip while asked, reveal clip at reveal, empty = whole video. Hidden video: the 🎵 cover over a full-size playing `<video>`, lifted at reveal without remounting; a visible question video restarts with the reveal clip at reveal.
- Phones show "🎧 Listen" for a hidden video file, as for YouTube.
- Sample import CSV: add one row with a video file link and a clip, if a stable public sample file URL is available; otherwise skip and note why in the ticket.
- DOCUMENTATION.md clip/reveal/hidden/CSV paragraphs and the `/guide` clip and hidden-video paragraphs say "video" (YouTube or video file).

See the spec's "One media classifier", "Clips", "Reveal rule" and "Hidden video" decisions.

**Blocked by:** 01

**Status:** done

Sample CSV row skipped: no stable public sample video URL could be verified (the sample file's audio row is itself an `example.com` placeholder), so no unverifiable link was added.

- [x] CSV round-trip test: `free_text` row with `.mp4` `media_url` and full notes group decodes to clip fields and encodes back identically.
- [x] CSV/record test: image `media_url` + `.mp4` `answer_media_url` keeps only the reveal clip.
- [x] Record codec test: clip fields stored for an `.mp4` `media_url`.
- [x] Editor test: pasting an `.mp4` shows the clip inputs and hidden checkbox; `.mp4` answer media labels "Answer video clip".
- [x] `/display` tests: `<video>` src carries the question clip fragment while asked and the reveal clip at reveal; hidden cover shown while asked, lifted at reveal with the same element (no remount).
- [x] `pnpm typecheck`, `pnpm lint` and the touched workspaces' tests pass.
