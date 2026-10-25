# 01: Pacing and felt difficulty on the final form

**What to build:** Add the two three-button rows ("How was the pace?", "How hard were the questions?") at the top of the phone's final feedback form. Each tap saves through a new players-only event (e.g. `RATE_SESSION`) that follows the final form's accept rule. Store one answer per (session, team) per scale without `SEND_FEEDBACK` wiping it, restore the answers on join, and change the `ended` thank-you on `/display` to "Tell us how it went on your phone ★".

Parent spec: `.scratch/feedback-pacing-difficulty/spec.md`

**Blocked by:** —

**Status:** ready-for-agent

- [ ] Shared: the scale values and payload schema; the accept rule reused from `getFeedbackField` / `describeFeedback`
- [ ] Backend (real Postgres): save, overwrite, refusals (feedback off, not `ended`, showdown in play), `SEND_FEEDBACK` leaving them alone and vice versa, restore on join; migration if storage changes
- [ ] Phone: no preselection, highlight, save on tap, restore after reconnect, error on a failed ack
- [ ] Display: new `ended` wording; break wording unchanged
- [ ] `DOCUMENTATION.md`: feedback field and final form, the event, storage, the `ended` screen
