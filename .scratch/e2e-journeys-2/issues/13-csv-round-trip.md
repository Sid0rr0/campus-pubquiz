# 13: CSV export and re-import

**What to build:** Export the full-night quiz as CSV from the UI, re-import it as a new quiz, and check the preview and the new quiz match the original (rounds, questions, media, clip notes, round notes, break placement).

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 02

**Status:** done

- [x] The exported file re-imports without errors.
- [x] The re-imported quiz matches the original question by question.
- [x] Passes `--repeat-each=5`.
