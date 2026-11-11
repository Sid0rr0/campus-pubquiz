# 05: Fun facts wait for results

**What to build:** With **Early answer reveal** on, fun facts on the break screen leave out the block in its break: its answers have aired, but its results haven't, so a fact like "most-missed question" would leak them. The rule becomes "blocks whose results are out"; with the setting off it's the same as today (see the [spec](../spec.md)).

- **Docs:** the fun facts paragraph in `DOCUMENTATION.md`. The `/guide` text goes in ticket 07.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Fun facts tests: with the setting on, no fact in a break draws on the block in play; with it off, unchanged
