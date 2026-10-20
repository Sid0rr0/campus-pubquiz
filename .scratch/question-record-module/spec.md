# Spec: One Question record codec for every shape a question takes

Status: ready-for-agent

Source: architecture review 2026-10-20, candidate 2 ("Strong", in-process).

## Problem Statement

A question exists in six shapes:

- **stored row:** the columns plus the payload JSON;
- **preview:** what the quiz editor and import work with;
- **seeded question:** the copy a session holds;
- **sheet row:** a CSV line;
- **editor draft:** what the quiz editor's form edits;
- **question view:** what screens receive.

The Question record codec was meant to be the one place a question is converted between them. In practice it covers only stored row ↔ preview and stored row → seeded question. The sheet row conversion, the editor draft conversion, the stored payload's type and the preview's type each restate the same field rules by hand.

What this costs the quiz master and the quiz author:

- **A clip typed in the editor is sent with an image or a sound and silently thrown away.**
  - The editor sends the clip start, clip end and hidden-video flag for any question media link.
  - The save keeps them only when the media is a video.
  - The author sees the clip in the form, saves, reloads, and it's gone. Nothing said it didn't apply.
  - There are four copies of the rule "the clip belongs only to a video question media; the reveal clip to either video": the save, the stored-row-to-seeded copy (which has no check at all), the CSV encode and decode pair, and the editor. They disagree.
- **"Unset stays unset" is broken by the preview schema.**
  - GLOSSARY says the Answer key owns the defaults for a question's grading settings.
  - The Number preview schema fills in a 10% margin while it validates.
  - CSV import stores what the schema returns, so every imported Number question gets an explicit 10% written into its payload. A later change to the default margin would never reach those questions.
  - The quiz save validates with the same schema but stores what it was sent, so the two ways in disagree about what validation means.
- **Adding a grading setting or a media field means editing about nine places by hand.**
  - Adding the margin touched: the setting name, the hand-written stored payload type, the payload schema, the preview schema, the hand-written preview type, the seeded question, the Answer key defaults, the editor's grading setting drafts, and the editor draft fields with two default sites.
  - The match scoring mode's two values are written out in three places.
  - A field missed in one place doesn't fail a test; it just goes missing on one path.
- **No test crosses every shape.**
  - The codec test, the CSV round-trip test and the editor draft test each check their own pair with their own fixtures.
  - The editor's tests never pass through the save's conversion, which is why the clip divergence went unseen.

## Solution

The Question record codec becomes deep: it owns every conversion between a question's shapes, driven by **one table of question fields**. Each row of the table names a field and says when a question carries it:

- **always**, e.g. prompt, answer, points, notes;
- **when the type's answer kind uses it**, e.g. options, match targets;
- **when the type's registry entry lists it as a grading setting**, e.g. match scoring mode, margin;
- **when the question media is a video**: the clip and the hidden-video flag;
- **when the question media or the answer media is a video**: the reveal clip;
- **when set**: the media links.

Every conversion copies fields by that table:

- stored row → preview;
- preview → stored fields;
- stored row → seeded question;
- preview ↔ sheet row (the media and clip half; each answer kind's own options and answer cell codec stays as it is).

So a field present in one shape is present in every shape that should carry it, and absent from every shape that shouldn't. The stored payload type and the preview type are inferred from their schemas instead of written out beside them.

The editor's draft conversion stays in the editor: its typed-text fields, such as a clip as "1:22" or a half-typed margin, are editor-only. But it asks the codec which media and clip fields a preview carries. A preview the editor sends therefore carries a clip only for a video, under the same rule as the save. The typed clip times stay in the draft, so switching the media back to a video keeps them.

Validation stops filling in defaults. A question with no margin is stored with no margin, and the Answer key fills in 10% wherever it is read, as it already does for a Number question with no stored margin.

What changes for users:

- **Clips.** The editor no longer sends a clip that the save would drop.
  - A clip typed while the media is a video and left in the draft after switching to an image is not saved.
  - Switching back to a video before saving still has it.
- **Margins.** A CSV-imported Number question is stored without a margin and still grades and displays with 10%. A question already stored with an explicit margin is unchanged.
- Everything else behaves exactly as today. This is a restructuring with two fixes.

## User Stories

1. As a quiz author, I want a clip I type for a video to be saved with the question, so that the big screen plays the part I chose.
2. As a quiz author who switched a question's media from a video to an image, I want the old clip not saved with the image, so that the stored question doesn't carry settings that mean nothing for it.
3. As a quiz author who switched from a video to an image and back before saving, I want my typed clip still there, so that a misclick doesn't cost me the times.
4. As a quiz author, I want a reveal clip saved when either the question media or the answer media is a video, so that an image question with an answer video can still play its reveal clip.
5. As a quiz author, I want the hidden-video flag saved only for a video question media, so that a sound or image is never "hidden".
6. As a quiz author importing a CSV, I want a Number question without a margin to use the default margin, so that it grades the same as before.
7. As a quiz author, I want an imported Number question to follow the default margin wherever it is defined, so that a future change to the default reaches it.
8. As a quiz author editing an imported Number question, I want the editor to show 10% for its margin, so that I can see what it grades with.
9. As a quiz author, I want a margin I set in the editor saved exactly as I set it, including 0 for "exact answer only".
10. As a quiz author, I want a match scoring mode I set saved only for a match question, so that switching a question's type doesn't leave a stray setting behind.
11. As a quiz author exporting a quiz to CSV and importing it again, I want every CSV-carried field to come back the same, so that the CSV is a safe backup for each question type and each media kind (image, sound, YouTube, video file).
12. As a quiz author, I want the clip in a CSV notes cell read only for a video question media, as today, so that a sheet written for the old rule keeps importing the same way.
13. As a quiz master running a session, I want the session's copy of each question to carry the same media and clip fields as the saved question, so that the big screen plays what the editor showed.
14. As a quiz master, I want a question's correct answer never to reach the phones or the big screen through the payload, so that the session copy stays safe, as today.
15. As a quiz master, I want a question saved before a field existed to load as it does today, so that old quizzes keep working.
16. As a quiz master, I want a clip group left in a question's notes by an older save still read and stripped, so that old questions keep their clips.
17. As a developer adding a grading setting to a question type, I want to add it to the registry entry, the field table and its schema, and have every conversion carry it, so that I can't forget a path.
18. As a developer adding a media field, I want one row in the field table to decide when every shape carries it.
19. As a developer, I want the stored payload type and the preview type inferred from their schemas, so that a type and its validator can't drift.
20. As a developer, I want the match scoring mode's values written once, so that adding a mode is one change.
21. As a developer, I want validation to return what it was given, never with defaults filled in, so that import and save store the same thing for the same input.
22. As a developer, I want one round-trip test for every question type and media kind through every shape, so that a field lost on any path fails a test.
23. As a developer, I want the editor's round-trip test to pass through the real codec, so that the editor and the save can't disagree unnoticed.
24. As a developer working on the editor, I want to ask the codec whether the question media is a video and which clip fields a preview carries, so that the editor holds no copy of the rule.
25. As a developer, I want the codec to remain pure (no I/O), so that its whole interface is testable with plain values.

## Implementation Decisions

### The codec and its field table

- The Question record codec, already in shared types, grows to own every conversion between question shapes. Its interface:
  - stored row and parsed payload → preview;
  - preview → stored fields (columns plus payload);
  - stored row and parsed payload → seeded question;
  - preview → sheet row, and sheet row → preview candidate. The sheet row decode keeps returning the candidate plus its sheet-only issues (a match answer not written as pairs, a clip time that isn't a timecode), and the round-level cells stay where they are.
  - a media fields query the editor uses: given a question's media link, answer media link and candidate clip fields, the clip fields a preview carries.
- One **field table**, internal to the codec, lists each payload and preview field with the condition under which a shape carries it:
  - always;
  - when set;
  - when the type's answer kind uses it;
  - when the type's registry entry lists it as a grading setting;
  - when the question media is a video;
  - when either media is a video.
- Every conversion copies fields through the table. No conversion names a media, clip or grading setting field outside it.
- The clip rule is the existing save rule, now applied by every conversion:
  - the clip and the hidden-video flag only for a video question media;
  - the reveal clip when either the question media or the answer media is a video.
- Stored row → seeded question gains the check it lacks today. Stored data already satisfies it, so no session changes.
- Grading settings keep coming from the question type registry's list for the type. The table refers to that list and doesn't copy it.
- Legacy notes stay as they are: a clip group left in notes by an older save is read, merged under the payload fields and stripped. Only the codec does this.
- The codec stays pure. The CSV kinds' options and answer cell codecs, and their validation by each kind's preview schema, are unchanged.

### Types and schemas

- **Preview type:** the hand-written preview type is replaced by the type inferred from the per-type preview schemas, taken as their input shape. The persisted question id, the notes and every optional field keep their names, so callers don't change.
- **Stored payload type:** the hand-written stored payload type is replaced by the type inferred from the per-type payload schemas. Payload parsing keeps dropping keys a type doesn't read, which is what keeps an old import's correct answer out of a question view.
- **Match scoring mode:** its values are declared once and the schemas, the payload and the question views use that declaration.
- **Margin default:** the Number preview schema no longer fills in a default margin. A missing margin stays missing, and the Answer key fills in the default when read, as it already does for a stored question without one.
- **Import and save store the same thing:** CSV import and the quiz save both store what they were sent once validation passes. No path stores a schema's parsed output in place of its input.

### The editor

- The editor draft keeps its own conversion, draft ↔ preview, for its typed-text fields and the per-answer-kind and per-grading-setting draft tables, which are already compile-checked per kind.
- **Clip:** the editor asks the codec which clip fields a preview carries for its media links. It no longer decides "is this a video" itself, and it no longer sends a clip for an image or a sound.
- **Typed values stay in the draft:** typed clip times and the hidden-video flag stay in the draft whatever the media, so switching back to a video keeps them.
- **Margin for an unset question:** the editor keeps showing 10% for a Number question with no stored margin. Saving from the editor writes the margin shown, as today.
- **Defaults:** the editor's default margin and match scoring mode are written once, not separately in the new-question factory and the load path.

### Docs, in the same change

- **GLOSSARY.md: Question record codec** is updated to say:
  - it converts between the stored row, the preview, the seeded question and the sheet row;
  - one field table decides when each shape carries a field;
  - the editor asks it for the media and clip rule.
- **DOCUMENTATION.md, Number question type:** the CSV paragraph says an imported Number question is stored with no margin and grades with the default, instead of "import fills in 10%". That a custom margin is lost on export → re-import stays true.
- **DOCUMENTATION.md, editor:** the editor section says clip times are saved only for a video question media.

## Testing Decisions

- **What makes a good test:** it puts a question in through the codec's interface and checks the shape that comes out. It never asserts on the field table itself or on which internal helper ran. The interface is the test surface.
- **One table-driven round trip in shared types** is the main test. For each question type crossed with each media kind (none, image, sound, YouTube, video file; plus an image question with an answer video):
  - preview → stored fields → preview gives the same preview;
  - stored → seeded question carries the same media, clip and grading setting fields, and never an answer from the payload;
  - preview → sheet row → preview gives the same preview for every CSV-carried field;
  - a field the type or media doesn't allow (a clip on an image, a margin on free text, a match scoring mode on a sort) is absent from every output shape.
  - This replaces overlapping cases in the existing codec test and CSV round-trip test. Their cases that test something the table doesn't (sheet issues, legacy notes, column names in issues) stay.
- **Margin:**
  - a Number preview with no margin validates and comes back with no margin;
  - stored and reloaded, it still has none;
  - its question view carries the default margin from the Answer key.
  - The existing margin tests are updated to this rule.
- **Frontend round trip:**
  - one editor test takes each question type through draft → preview → stored fields (the real codec) → preview → draft, and checks that the draft comes back unchanged;
  - a draft with a typed clip and image media sends no clip, and keeps its typed clip in the draft.
- **Backend:** the existing CSV import and quiz save service specs gain one case each showing that a Number question with no margin is stored with no margin.
- **Type parity:** the existing question kind parity test keeps checking that every registry type has a preview schema and a payload schema. Inferring the types removes the need for any hand-kept parity of the type shapes.
- **Prior art:**
  - the question CSV round-trip test, which already goes per type over a fully populated question;
  - the question record codec test;
  - the question kind parity test;
  - the quiz draft state test.
- E2E: run `pnpm e2e` once before the PR. The CSV round-trip journey and the editor create-and-play journey already cross these paths.

## Out of Scope

- The question type registry producing every per-type list: the ESLint mirror and the editor's hard-coded kahoot message (architecture review candidate 6).
- Splitting the editor's draft model from its round-list operations and toast wording, or moving the margin hint and media gating out of the editor's form (architecture review frontend candidate 5).
- A CSV column for the margin or the match scoring mode. Export → re-import still loses a custom one, as documented.
- Changing which media may carry a clip, or the clip notes syntax in CSV.
- The question view a screen receives, and the Screen projection (architecture review candidate 3).
- Rewriting stored payloads. Existing questions with an explicit 10% margin keep it, and no migration runs.

## Further Notes

- Decisions confirmed with the user on 2026-10-20:
  - the seam is one shared codec with a table-driven round trip, plus one frontend test that crosses the real codec;
  - unset stays unset for the margin;
  - stale clip times are dropped from the preview but kept in the draft.
- No ADR is touched. ADR 0003 (Number is its own question type) is what makes a grading setting a registry-listed, per-type field, and the field table builds on that.
- Typing the preview as the schemas' input shape matters: their output shape would bring back defaults filled in by validation.
