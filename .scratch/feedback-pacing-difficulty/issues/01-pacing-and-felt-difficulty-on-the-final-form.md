# 01: Pacing and felt difficulty on the final form

**What to build:** Add the two three-button rows ("How was the pace?", "How hard were the questions?") at the top of the phone's final feedback form. Each tap saves through a new players-only event (e.g. `RATE_SESSION`) that follows the final form's accept rule. Store one answer per (session, team) per scale without `SEND_FEEDBACK` wiping it, restore the answers on join, and change the `ended` thank-you on `/display` to "Tell us how it went on your phone ★".

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** —

**Status:** done

- [x] Shared: the scale values and payload schema; the accept rule reused from `getFeedbackField` / `describeFeedback`
- [x] Backend (real Postgres): save, overwrite, refusals (feedback off, not `ended`, showdown in play), `SEND_FEEDBACK` leaving them alone and vice versa, restore on join; migration if storage changes
- [x] Phone: no preselection, highlight, save on tap, restore after reconnect, error on a failed ack
- [x] Display: new `ended` wording; break wording unchanged
- [x] `DOCUMENTATION.md`: feedback field and final form, the event, storage, the `ended` screen

For tickets 03, 05 and 06: the scales are `PACING_VALUES` / `FELT_DIFFICULTY_VALUES` (types `Pacing`, `FeltDifficulty`), both under `SESSION_SCALE_VALUES` keyed `pacing` / `feltDifficulty` (type `SessionScale`, values `SessionScaleValue<S>`), in scale order; `SessionScaleCounts<S>` is a count per value; labels are `SESSION_SCALE_VALUE_LABELS` (lower-case them for a count line). All in `shared/types/src/session-scales.ts`. Answers are stored on `session_feedback` as nullable `pacing` and `felt_difficulty` columns.
