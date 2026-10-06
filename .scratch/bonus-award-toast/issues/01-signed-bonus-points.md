# 01: Signed bonus points everywhere

**What to build:** Bonus points display with an explicit sign wherever a team or the quiz master sees a **bonus award** (see `CONTEXT.md`): "+1", "−1" (a real minus sign), "+0.5". This ticket adds one signed-points formatter next to the existing bonus display helpers (the category labels) and uses it in the `/play` bonus drawer. That fixes the drawer showing a penalty as "+-1 pt". Tickets 02 and 03 reuse the formatter for their toasts. Spec: `.scratch/bonus-award-toast/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Bonus drawer: a penalty of −1 displays as "−1 pt", not "+-1 pt" (bonus-progress page test, tested first)
- [x] Bonus drawer: a positive award still displays as "+1 pt", and a half-point award as "+0.5 pt"
- [x] One shared formatter is exported for reuse by the toasts; it is covered through the drawer test, with no separate unit test

## Comments

Implemented: `formatSignedPoints` is exported from `apps/frontend/app/lib/bonus-categories.ts` and used by the custom-award rows in the `/play` bonus drawer. The drawer test is parameterised over +1, +0.5 and −1 (red first for −1, which rendered "+-1 pt"). Commit: see git history for this ticket's `feat(frontend)` commit.
