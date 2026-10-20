# 04: "Like the night" order

Status: done

Spec: [Quiz preview](../spec.md)

**What to build:** The quiz master switches the preview to "like the night" and sees the screens in the order the room will: the round overview, round title cards, a block's questions, the break intro, the reveal intro, then that block's reveals, block after block. The order comes from a dry run of the real Advance plan over the module's team-less session (no grading writes, nothing saved, as the presenter preview does), keeping only `round_overview`, `round_title`, `question`, `break_intro`, `reveal_intro` and `reveal`. Lobby, rules, join overlay, locking, break review, break round title, leaderboard, showdown and ended never appear. The `break_intro` has no deadline, no feedback prompt and no fun facts.

The page gets a mode toggle; the mode is kept in the URL as `?mode=night` (the default, question → answer, is omitted) and survives a refresh.

**Blocked by:** 03.

- [ ] Module test: for a multi-block quiz with a kahoot round, `night` steps match, kind for kind, the display screens a real session reaches by pressing Advance from Start quiz to the end, with the left-out kinds removed.
- [ ] Endpoint accepts `mode=night`.
- [ ] Page tests: the toggle switches order; `?mode=night` is read on load and written on toggle.
- [ ] `DOCUMENTATION.md` mentions both orders.
