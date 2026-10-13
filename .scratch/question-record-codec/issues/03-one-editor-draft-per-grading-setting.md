# 03: One editor draft entry per grading setting

**What to build:** The quiz editor loads and saves every grading setting through one table keyed by grading setting name, beside the answer-kind drafts. A match question's scoring mode and a Number question's margin each become one entry, so adding a setting is one entry and a missing one fails typecheck. Quiz masters see exactly today's editor: the default margin on a new question, scoring mode and margin surviving save and reload, and an unreadable margin refused by the server.

Parent spec: `.scratch/question-record-codec/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The editor's grading-setting draft table is a record over every grading setting name, each entry loading its editor fields from a preview and saving them back.
- [ ] The match scoring mode moves out of the match answer-kind draft into its entry; the margin load/save helpers become its entry.
- [ ] Only the settings the type's registry entry lists are saved; a type without a setting saves none.
- [ ] Today's behaviour is kept: defaults shown for a new question, NaN saved for an unreadable margin so the server refuses it, and changing a question's type keeps or drops the answer as today.
- [ ] The draft-state suite gains a preview → editor question → preview round trip for every question type, asserting the scoring mode and margin survive, a type without a setting saves none, and an unreadable margin still saves as NaN.
- [ ] The existing quiz editor tests pass unchanged.
- [ ] `pnpm typecheck`, `pnpm lint` and the frontend tests pass.
