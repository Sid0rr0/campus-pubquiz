# 05: Big-screen feedback prompts

**What to build:** The big screen reminds the room that feedback exists: "Rate the rounds on your phone ★" on the break card, and "Tell us what you thought — on your phone" on the final screen. Both are hidden when "Collect feedback" is off. The final-screen line only appears on the `ended` screen itself, not while a showdown is being played.

The display screen projection's break card and ended screen carry a flag that says whether to show the prompt; `/display` draws the line from that flag and works nothing out itself.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: the display screen for `break_intro` and `ended` says to show the feedback prompt when the setting is on.
- [ ] With the setting off, neither screen says to show it.
- [ ] `/display`: the break card and the final screen draw their prompt lines from the flag, and draw nothing when it is false.
- [ ] `DOCUMENTATION.md`'s big-screen descriptions of `break_intro` and `ended` mention the prompt.
