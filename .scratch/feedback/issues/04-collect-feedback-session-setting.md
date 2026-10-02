# 04: "Collect feedback" session setting

**What to build:** The quiz master gets a "Collect feedback" switch in the lobby session settings panel on `/control`, on by default. Sessions created before this feature, whose stored settings have no such field, count as on. Like every other session setting it can't be changed once the quiz has started. When it is off, phones never show the break card or the final form (the `ended` phone screen is just "Quiz complete!" again), and the server refuses ratings and Send with "Feedback is off for this session".

The setting is `collectFeedback: boolean` on the session settings, its defaults and its partial-settings Zod schema. The shared "open for rating" rule returns nothing when it is off, so the projection and the refusal stay in step.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 01, 03

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: with `collectFeedback` off, the players view's feedback field is empty in a break and at `ended`.
- [ ] With it off, a rating and a Send are each refused with "Feedback is off for this session".
- [ ] A new session has it on; a stored settings JSON without the field reads as on.
- [ ] Changing it after the lobby is refused, like the other settings.
- [ ] `/control`: the lobby settings panel shows the switch and saves it.
- [ ] Docs: `DOCUMENTATION.md` lists the setting; the `/guide` page explains the switch and what teams see in the break and at the end.
- [ ] The update-session-settings and session-creation-defaults specs pass, apart from mechanical updates for the new field.
