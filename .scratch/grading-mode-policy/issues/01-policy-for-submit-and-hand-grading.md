# 01: Grading policy for submit and hand grading

**What to build:** Add the Grading policy module and route the two per-answer grading events through it: a team's submit and the quiz master's hand grade. Every answer grades exactly as it does today. The answer module stops checking the grading mode for these two events.

- **First, pin a gap against today's code.** The quiz master hand-grades an auto-graded answer (e.g. adjusts a match answer's partial credit). The team then resubmits exactly the same value. Today the answer is rescored automatically and the override is lost, because only match-or-human keeps the grade on a same-value resubmit. Add a test to the answer module's grading spec that pins this, and make sure it passes before any production change.
- **The Grading policy.** A pure module (no Nest, no database, no session) in the backend answer module, keyed by grading mode as a `Record<GradingMode, …>`, so a new grading mode fails typecheck until every event has an answer. It reads the grading mode from the question type registry entry, and every score comes from Scoring. This ticket gives it:
  - _submit_: question, submitted value and the team's stored grade (if any) → set (points, verdict), clear, or keep. Today's rules: an auto score always sets; a match-or-human same-value resubmit with a grade keeps it; a revision with no automatic score clears; a first submission with no automatic score is stored ungraded.
  - _can grade by hand_: question and stored grade → allowed or not. A batch answer is allowed only once graded.
  - the private **"graded automatically"** rule: a stored grade equal to what the submit-time grade gives against a given key. Submit's keep rule uses it now, and ticket 02's key fix will reuse it.
- **The answer module** applies what the policy returns on submit and hand grade. Its upsert and merge fields come out exactly as today, and keep is a no-op. The hand-grade refusal message is unchanged.
- **GLOSSARY.md:** add **Grading policy**, "the one rule set for what each grading mode does on each grading event: submit, hand grade, lock, kahoot speed scoring, key fix". _Avoid_: grading rules, grading service.

Parent spec: `.scratch/grading-mode-policy/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] A test pins today's same-value resubmit after a hand override of an auto-graded answer (rescored, override lost). It passes before any production change.
- [ ] A new pure Grading policy table spec (Jest, no database, no Nest) covers _submit_ (first submit; same value graded; same value ungraded; changed value) and _can grade by hand_ (batch before and after the batch), for at least one registry type per grading mode.
- [ ] The answer module's submit and hand grade no longer call `isMatchOrHumanType` or `isBatchGradedType`. The decision comes from the policy.
- [ ] `submit-and-list.spec.ts`, `grading.spec.ts`, `auto-grading.spec.ts`, `verdict.spec.ts` and the real-store gateway specs pass with no changed expectations.
- [ ] GLOSSARY.md has the Grading policy entry.
- [ ] No behaviour, wire, schema or migration change. `pnpm typecheck`, `pnpm lint` and the backend tests are green.
