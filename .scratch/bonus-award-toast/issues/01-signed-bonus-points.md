# 01: Signed bonus points everywhere

**What to build:** Bonus points display with an explicit sign wherever a team or the quiz master sees a **bonus award** (see `CONTEXT.md`): "+1", "−1" (a real minus sign), "+0.5". This ticket adds one signed-points formatter next to the existing bonus display helpers (the category labels) and uses it in the `/play` bonus drawer. That fixes the drawer showing a penalty as "+-1 pt". Tickets 02 and 03 reuse the formatter for their toasts. Spec: `.scratch/bonus-award-toast/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Bonus drawer: a penalty of −1 displays as "−1 pt", not "+-1 pt" (bonus-progress page test, tested first)
- [ ] Bonus drawer: a positive award still displays as "+1 pt", and a half-point award as "+0.5 pt"
- [ ] One shared formatter is exported for reuse by the toasts; it is covered through the drawer test, with no separate unit test
