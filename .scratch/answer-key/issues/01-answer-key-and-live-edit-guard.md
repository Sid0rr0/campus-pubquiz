# 01: Answer key module, used by the live-edit guard (fixes the match bug)

**What to build:** A live save that doesn't change an opened question's answer key no longer triggers a key fix. In particular, an unrelated save during a live session no longer wipes the overrides on an opened match question imported from CSV. The Answer key module is built here, and the live-edit guard is its first consumer.

- **Reproducers first, red against today's code:**
  - In the live-edit guard spec: an opened match question with no stored scoring mode, saved with `partial` and nothing else changed, is not selected for a regrade. Today it is.
  - Through the gateway, in the live edit regrade spec: a match question with no stored scoring mode, as CSV import leaves it, is opened. A team answers, and the quiz master overrides its partial credit. A save that changes only a question in a later round leaves the override in place, sends no key-fix answer lists or team syncs for that question, and leaves the leaderboard unchanged.
- **The registry entry declares which grading settings its type carries.** This replaces the boolean `hasMargin` and also covers match's scoring mode. `hasMarginType` keeps its interface and reads the declaration.
- **The Answer key module**, in shared next to Scoring, is pure. Its interface:
  - _grading settings of a question_: type plus any optional settings → the type's settings with defaults filled in (match: scoring mode, default `partial`; Number: margin, default 10%). Settings the type doesn't carry are dropped. It works on any question shape, including a `QuestionView`.
  - _answer key of a question_: `{ answer, points }` plus those settings.
  - _same answer key_: compares answer, points and settings by value. A margin compares by value and unit, whatever the field order.
- **The live-edit guard's key-fix selection** compares the stored and incoming questions' Answer keys. The grading-field list, the margin-only equality special case and the effective-margin helper go. The opened-question structure check (type, choices, match targets) is unchanged.
- **Docs:**
  - `GLOSSARY.md`: add **Answer key**. "What an answer is graded against: the correct answer, the points, and the question type's grading settings (a match question's scoring mode, a Number question's margin), with any setting left unset filled in with its default. A key fix is a change to an opened question's answer key." _Avoid_: grading fields, key fields.
  - `DOCUMENTATION.md`: the live-edit section that lists which changes trigger a regrade says they are compared as Answer keys with defaults filled in, so a setting left unset and one saved as its default are the same.

Parent spec: `.scratch/answer-key/spec.md`

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Both reproducers fail against today's code, and pass after the change.
- [ ] A new Answer key table spec (Vitest, in shared), built from the registry so a new question type needs no new row. It covers each type's resolved settings with none stored, with each setting stored, and with a setting the type doesn't carry (dropped).
- [ ] It also covers _same answer key_: unset vs the default (same); margin fields in another order (same); a different scoring mode, margin, answer or points (different); a difference only in a setting the type doesn't carry (same).
- [ ] The live-edit guard spec's existing margin and scoring-mode cases, `live-edit-regrade.spec.ts` and `quiz-edited.spec.ts` pass unchanged.
- [ ] No `.type === '<literal>'` checks are added. GLOSSARY.md and DOCUMENTATION.md are updated.
- [ ] No wire, schema, migration or CSV change. `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
