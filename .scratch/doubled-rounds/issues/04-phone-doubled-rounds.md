# 04: Phone: round marks and the extra-joker button use the module

**What to build:** A team's phone works out its doubled rounds with ticket 01's module, so its round marks, question picker marks, "+N" joker extra on a revealed answer and the extra-joker buy button agree with what the server doubles and refuses. The team sees the same phone as today.

Parent spec: `.scratch/doubled-rounds/spec.md`

**Blocked by:** 01 (Doubled rounds module)

**Status:** ready-for-agent

- [ ] The phone's doubled-rounds list asks the module for the round ids and maps them to round number and title at the edge, keeping quiz order and the "" title of a blind purchase.
- [ ] The power-ups list hides the extra-joker buy target when the module says the offered round is already doubled, replacing its own joker-round and bought-round checks. Skip this item if `power-up-offer` ticket 02 has already landed: the list then renders the Power-up offer's entries and has no check of its own left.
- [ ] The existing joker-round helper tests and power-ups list tests pass unchanged; the e2e power-ups journey passes (`pnpm e2e`).
- [ ] `pnpm crap:changed` passes.
