# 05: Big-screen feedback prompts

**What to build:** The big screen reminds the room that feedback exists: "Rate the rounds on your phone ★" on the break card, and "Tell us what you thought — on your phone" on the final screen. Both are hidden when "Collect feedback" is off. The final-screen line only appears on the `ended` screen itself, not while a showdown is being played.

The display screen projection's break card and ended screen carry a flag that says whether to show the prompt; `/display` draws the line from that flag and works nothing out itself.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 04

**Status:** done

- [x] Written first, failing against today's code: the display screen for `break_intro` and `ended` says to show the feedback prompt when the setting is on.
- [x] With the setting off, neither screen says to show it.
- [x] `/display`: the break card and the final screen draw their prompt lines from the flag, and draw nothing when it is false.
- [x] `DOCUMENTATION.md`'s big-screen descriptions of `break_intro` and `ended` mention the prompt.

## Comments

Implemented in a single commit, `feat(frontend): big-screen feedback prompts` (find it with `git log --grep "big-screen feedback prompts"`; the hash isn't known until the commit exists).

- Flag: the display screen's `break_intro` and `ended` kinds carry `isFeedbackPromptShown`, set in `describeOnAirScreen` from the snapshot's `settings.collectFeedback` (absent settings read as off). The showdown is its own screen kind, so the final-screen line can't appear while one is played.
- `/display`: `BreakIntroScreen` draws "Rate the rounds on your phone ★" and the `ended` screen draws "Tell us what you thought — on your phone", each only when the flag is true.
- Docs: `DOCUMENTATION.md` (the `break_intro` and `ended` rows, and a paragraph on the flag). No `/guide` change: nothing on `/control` moved.
- Specs: `display-feedback-prompt.spec.ts` (real database, written first and failing) for on and off at both screens, plus the page cases in `screen-kind.test.tsx` and the exact-shape expectations in `on-air-screen.spec.ts`. Full suites and lint pass.
