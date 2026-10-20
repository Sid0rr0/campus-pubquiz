# 01: Switching to Closest guess clears a non-numeric answer

**What to build:** In the quiz editor, switching a question to Closest guess clears an answer that doesn't read as a number, as switching to Number already does. Today a Free text question answered "Paris" switched to Closest guess keeps "Paris", and the quiz master only finds out when the save is refused. A numeric answer is kept, and switching between Number and Closest guess keeps it. Switching to any type without a numeric answer keeps the answer, as today.

Start by removing a duplicate. Each registry entry has an answer input kind and also a choices field, which is "required" exactly when the input kind is "choice". The choices field is removed. The answer kind resolver reads the input kind only, so a type's answer kind is its input kind; no type's answer kind changes. The helper that returns a type's input kind has no callers and is deleted.

Then add a registry helper beside the other per-type helpers in the Scoring module. It says whether a type has a numeric answer key, and it is derived from the answer kind (true when the kind is "number"), not stored as a field. Today that is Number and Closest guess. The editor's type change clears the answer when the new type has a numeric key and the answer doesn't read as a number. This replaces today's check for whether the new type carries a margin.

See the spec's "Registry facts" and "Lists derived from the registry → The editor's type change".

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The registry entry has no choices field, the answer kind resolver reads the input kind only, and the unused input-kind helper is gone.
- [ ] The numeric-answer-key helper exists, derived from the answer kind.
- [ ] Registry parity test cases:
  - the helper is true for exactly the types whose answer kind is a number (Number and Closest guess) and false for the rest;
  - every type's answer kind equals its input kind.
- [ ] Editor draft spec cases:
  - Free text with a text answer switched to Closest guess clears the answer;
  - Free text with a numeric answer switched to Closest guess keeps it;
  - Number switched to Closest guess, and back, keeps a numeric answer;
  - switching to a type without a numeric key keeps the answer;
  - the existing switch-to-Number cases still pass.
- [ ] The phone's answer input, scoring and answer formatting are unchanged for every type (the existing answer kind and scoring tests pass).
- [ ] DOCUMENTATION.md: the question types section says a type needs a numeric answer when its answer kind is a number, and the quiz editor section says a type change clears a non-numeric answer for Number and Closest guess.
- [ ] The `/guide` page mentions the Closest guess clearing if it describes switching a question's type.
- [ ] `pnpm typecheck`, `pnpm lint` and the shared types and frontend tests pass.
