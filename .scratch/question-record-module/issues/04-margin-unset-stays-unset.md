# 04: A Number question with no margin is stored with no margin

**What to build:** A Number question imported from CSV (which has no margin column) is stored with no margin rather than an explicit 10%. It still grades and displays with the default margin, because the Answer key fills it in when read, so a future change to the default reaches it. Validation no longer fills in defaults: CSV import and the quiz save both store what they were sent once it validates, so the same input stores the same thing on both paths. Questions already stored with an explicit margin are left alone, and no migration runs. The editor keeps showing 10% for a question with no stored margin and saves the margin it shows, as today.

Parent spec: `.scratch/question-record-module/spec.md`

**Blocked by:** None (can start immediately; can run in parallel with 01–03)

**Status:** done

- [ ] The Number preview schema has no default margin. A Number preview with no margin validates and comes back with none.
- [ ] CSV import stores the validated input, never the schema's parsed output, the same as the quiz save.
- [ ] A Number question with no stored margin:
  - shows 10% in the editor;
  - grades with 10%;
  - its question views carry the default margin from the Answer key.
- [ ] Shared specs: the existing margin tests are updated to "unset stays unset".
- [ ] Backend specs: the CSV import and the quiz save service specs each gain a case showing a Number question with no margin is stored with no margin.
- [ ] DOCUMENTATION.md's Number question type section says an imported Number question is stored with no margin and grades with the default, instead of "import fills in 10%". That a custom margin is lost on export → re-import stays.
- [ ] Typecheck, lint and tests pass.
