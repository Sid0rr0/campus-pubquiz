# 04: "Collect feedback" session setting

**What to build:** The quiz master gets a "Collect feedback" switch in the lobby session settings panel on `/control`, on by default. Sessions created before this feature, whose stored settings have no such field, count as on. Like every other session setting it can't be changed once the quiz has started. When it is off, phones never show the break card or the final form (the `ended` phone screen is just "Quiz complete!" again), and the server refuses ratings and Send with "Feedback is off for this session".

The setting is `collectFeedback: boolean` on the session settings, its defaults and its partial-settings Zod schema. The shared "open for rating" rule returns nothing when it is off, so the projection and the refusal stay in step.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 01, 03

**Status:** done

- [x] Written first, failing against today's code: with `collectFeedback` off, the players view's feedback field is empty in a break and at `ended`.
- [x] With it off, a rating and a Send are each refused with "Feedback is off for this session".
- [x] A new session has it on; a stored settings JSON without the field reads as on.
- [x] Changing it after the lobby is refused, like the other settings.
- [x] `/control`: the lobby settings panel shows the switch and saves it.
- [x] Docs: `DOCUMENTATION.md` lists the setting; the `/guide` page explains the switch and what teams see in the break and at the end.
- [x] The update-session-settings and session-creation-defaults specs pass, apart from mechanical updates for the new field.

## Comments

Implemented in a single commit, `feat(backend): "Collect feedback" session setting` (find it with `git log --grep "Collect feedback"`; the hash isn't known until the commit exists).

- Setting: `collectFeedback: boolean` on `SessionSettings` (default `true` in `DEFAULT_SESSION_SETTINGS`) and on the partial-settings Zod schema. The lobby-only rule needed no change, so it covers the new field.
- Rule: `describeFeedback` takes `isFeedbackCollected` and returns `null` first when it is off, so the players view's feedback field is empty in a break and at `ended`; `getFeedbackField` passes the session's setting in.
- Refusal: `GameStateService.isFeedbackCollected`; the `RATE_ROUND` and `SEND_FEEDBACK` handlers refuse with "Feedback is off for this session" (`FEEDBACK_OFF_REASON`) after the team check and before the open-for-rating check.
- Old sessions: `SeedService.loadGame` fills a missing `collectFeedback` as `true` — the one place stored settings enter a running session.
- `/control`: a "Collect feedback" checkbox in `SessionSettingsForm`, saved with the rest by the lobby settings panel.
- Docs: `DOCUMENTATION.md` (the setting, and the new refusal on both events) and a "Feedback from teams" section on `/guide`.
- Specs: `collect-feedback-setting.spec.ts` (real database, written first and failing), plus mechanical additions to `session-settings.schema.spec.ts`, the shared defaults test, `session-settings-form.test.tsx`, `session-settings-panel.test.tsx` and `guide-content.test.tsx`. Full suites and lint pass.
- Not touched: the big-screen `collectFeedback` flag on the display projection belongs to ticket 05.
