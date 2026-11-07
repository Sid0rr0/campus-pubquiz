# 03: Choose the mode when a quiz is created

**What to build:** The new-quiz form and CSV/Sheets import ask pub or quickfire (default pub), and an import into a quickfire quiz follows its rules.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** 02

**Status:** done

- [ ] `POST /quizzes` and the import endpoints take `mode` (Zod-validated, default `pub`).
- [ ] A quickfire import refuses rows with a non-quickfire-allowed type, using the editor's message, and fills a blank `points` cell with 1000; `break_after` is accepted and ignored. CSV columns unchanged; export unchanged.
- [ ] New-quiz form and import dialog have the pub / quickfire choice.
- [ ] Quiz list shows a "Quickfire" label.
- [ ] E2E quickfire helper imports with mode quickfire.
- [ ] `DOCUMENTATION.md` (CSV, quiz creation) and `/guide` updated.
