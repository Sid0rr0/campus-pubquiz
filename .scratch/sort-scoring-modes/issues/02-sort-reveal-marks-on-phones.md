# 02: ✓/✗ marks on phones for revealed sort answers

**What to build:** At reveal, a team's phone shows its submitted sort order item by item, each marked ✓ or ✗ for whether it sits in its correct slot, above the correct order as today. See the [spec](../spec.md), user stories 18–22.

- **The per-slot comparison:** a pure function in shared types that compares a submitted sort value with the key slot by slot, splitting and trimming exactly as sort scoring does, and returns one in-place flag per submitted item. Ticket 03's `per_item` scoring reuses it, so marks and points can't disagree.
- **The `/play` question browser:** in revealing mode, for a sort question with a real answer (not blank, not "I don't know"), "Your answer" renders as the marked item list. The verdict colour and points line are unchanged. No marks before the reveal, for no answer or for "I don't know". When the moderator overrode the points, the marks still show and the points and colour follow the override.
- **The protocol doesn't change:** the players' view already carries the correct answer at reveal.
- **Docs:** the `/play` reveal row in `DOCUMENTATION.md`. Any `/guide` text goes in ticket 04.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] Shared-types tests for the comparison: right order, one swap, shifted by one, stray whitespace and empty items
- [ ] A Vitest render test of the question browser: a revealed sort question marks the right items ✓ and ✗
- [ ] The same test: no marks before reveal, with no answer or for "I don't know"; marks present with an overridden score
- [ ] `DOCUMENTATION.md` reveal row updated
