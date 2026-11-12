# 03: Perfect-round fun fact

**What to build:** The break screen's fun fact rotator can say "N teams have had a perfect round so far", or "Only <team> has had a perfect round" when exactly one team has (see the [spec](../spec.md)). It is skipped when no team has one. Fun facts only show on the pub quiz break screen, so quickfire never shows it.

- **Fun fact (shared types):** a new kind `perfect_rounds` with `{ teamCount: number; teamName?: string }`. `teamName` is present only when `teamCount` is 1. It counts distinct teams with at least one **Perfect round** across every revealed round so far (the same "revealed" set the other facts use), using ticket 02's perfect-round helper. It sits next to `clean_sweep` in the fact order. Both facts can show.
- **Rotator (frontend):** words both forms.
- **Docs:** a row in the fun facts table of `DOCUMENTATION.md`.

**Blocked by:** 02 (Perfect rounds 🔥 on the leaderboard)

**Status:** ready-for-agent

- [ ] The fact counts teams across every revealed round, and a team with several perfect rounds is counted once
- [ ] `teamName` is present only when the count is 1
- [ ] The fact is skipped at 0, and unrevealed rounds aren't counted
- [ ] The rotator words both forms
- [ ] `DOCUMENTATION.md` fun facts table updated
