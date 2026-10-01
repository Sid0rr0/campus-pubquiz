# 01: One round title card component for round_intro, break_round_intro and reveal_intro

**Status:** needs-triage

**What to build:** The big screen draws a round title card (see **Round title card** in `CONTEXT.md`) in three statuses, with three copies of the same markup:

- `round_intro` — inline in `apps/frontend/app/display/page.tsx`: "ROUND N — category", round title, optional "by author"
- `break_round_intro` — `apps/frontend/app/display/break-round-intro-screen.tsx`: "ROUND N", round title
- `reveal_intro` — `apps/frontend/app/display/reveal-intro-screen.tsx`: "REVEALING ANSWERS · ROUND N", round title

Extract one display component that takes the label line, the round title and an optional author, and draw all three cards with it. This is a display-only refactor: the three **statuses** stay separate (DOCUMENTATION.md's Statuses section explains why `break_round_intro` must not reuse the other two), and what each card says stays the same. The label's text size currently differs (`text-display-sm` vs `text-display-lg` on the reveal card); pick one deliberately or keep it a prop.

- [ ] One round title card component is used for all three statuses; the two single-purpose screen files and the inline `round_intro` markup are gone
- [ ] Each card still shows the same text as today (existing display tests for round intro, break and reveal pass unchanged)
- [ ] No change to game statuses, transitions or the backend
