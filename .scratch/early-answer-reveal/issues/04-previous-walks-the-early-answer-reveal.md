# 04: Previous walks the early answer reveal

**What to build:** With **Early answer reveal** on, Previous steps back through the early answer reveal instead of break review (see the [spec](../spec.md)):

- `break_intro` → the block's last `answers` question, with the answer showing. There's no break review and no `break`/`break_round_intro` on this path.
- Back through `answers`/`answers_intro`, mirroring the forward walk.
- A block's first `answers_intro` → the previous block's `break_intro` (for the first block, wherever Previous goes from before that block today). A locked block never reopens.
- A `round_intro` reached from a break → that block's `break_intro`, leaderboard hidden, every grade kept.
- **Docs:** `DOCUMENTATION.md`'s Previous paragraph. The `/guide` text goes in ticket 07.

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Backward transition tests cover each rule above, with the setting on and off
- [ ] Walking forward then all the way back then forward again lands on the same screens
- [ ] `/remote`'s Previous description matches each step
