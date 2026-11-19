# 02: Block grading reads the transition facts

**What to build:** Block grading's move entry takes the transition facts from the move pipeline instead of combining status predicates itself. Three rules come from the facts: refusing Advance out of a break while the block is ungraded (still read from the database), the quickfire speed scoring when a question leaves locking, and the closest-guess batch when the block reaches a graded or revealing status. Grading at placement (creation and restart restore) keeps its own entry. No behaviour change.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Block grading's move entry has no break-exit, locking-exit or graded-status conditions of its own; it reads the facts
- [ ] Placement grading is unchanged
- [ ] Existing specs pass without changing their expectations: ungraded refusal on leaving a break (Advance only; Previous and End quiz pass), quickfire rescale (including going back into locking and out again), closest-guess batch with Early answer reveal on and off, /control's stale answer lists refreshed
- [ ] `pnpm typecheck`, `pnpm test` and `pnpm crap:changed` pass
