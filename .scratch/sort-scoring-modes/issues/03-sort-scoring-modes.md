# 03: Sort scoring modes exact / per_item / one_off

**What to build:** A quiz writer can set a sort question's scoring mode, in the CSV (`scoring: "per_item"`) or in the editor, and teams' sort answers score by it. Unset scores as today (`exact`). See the [spec](../spec.md) for the rules.

- **The setting on sort:** the question type registry lists `scoringMode` in sort's grading settings. Sort accepts `exact`, `per_item` and `one_off`. The Answer key's `scoringMode` default now depends on the type: `exact` for sort, `per_item` for match. It stays the only place defaults are filled in.
- **Scoring:** the sort answer format scores by the resolved `scoringMode`:
  - `exact`: today's comparison.
  - `per_item`: points × items in place ÷ item count, to the nearest half point, using ticket 02's per-slot comparison.
  - `one_off`: Half points when exactly two slots differ and they hold each other's item; otherwise `incorrect`.

  Verdict `partial` when 0 < points < full, `incorrect` at 0. Kahoot speed scales the points as today.
- **Boundaries:** the sort payload schema accepts only sort's modes and the match one only match's, so the editor, the REST save and the import all refuse `exact` on match and a junk value on sort.
- **The editor:** the scoring-mode picker shows on sort questions, lists only the type's modes ("Exact order only" / "Points per item in place" / "Half points for one mistake") and shows the type's default when unset.
- **Live key fix:** changing a shown sort question's `scoringMode` re-scores its answers through the existing key-fix path.
- **Docs:** the `DOCUMENTATION.md` sort section and the notes-group `scoring:` values. The `/guide` text goes in ticket 04.

**Blocked by:** 01 (Rename the scoring mode to one shared setting and vocabulary), 02 (✓/✗ marks on phones for revealed sort answers)

**Status:** done

- [ ] `scoreSubmission` tests for sort: each mode on a right, part-right, two-swapped and shifted-by-one order, plus rounding, verdicts, kahoot speed and unset as `exact`
- [ ] Import boundary and CSV round-trip tests: every sort mode accepted, `exact` on match and junk on sort rejected, and the round trip is lossless
- [ ] Editor draft-state test: the sort picker offers sort's modes and saves `scoringMode`
- [ ] Live-edit regrade spec: changing a shown sort question's mode re-scores its answers
- [ ] `DOCUMENTATION.md` sort section updated
