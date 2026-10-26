# 01: Rename the scoring mode to one shared setting and vocabulary

**What to build:** Match questions keep scoring exactly as today, but under the shared **Scoring mode** vocabulary from the [spec](../spec.md). The grading setting `matchScoringMode` becomes `scoringMode`, and its values `partial` / `all_or_nothing` become `per_item` / `one_off`. Sort is untouched in this ticket; ticket 03 gives it the setting.

- **Everywhere the setting appears:** the scoring-mode declaration (now the one home of the values `exact`, `per_item`, `one_off`; match accepts `per_item` and `one_off`), the question type registry's grading settings, the payload schema, the Answer key (match default `per_item`), the question views, the question record codec, the editor draft state and the editor's match picker. The picker's labels become "Points per item in place" / "Half points for one mistake".
- **The CSV notes group:** `scoring:` reads `per_item` and `one_off`, and still reads the old `partial` and `all_or_nothing` as those (for any type). Serializing writes only the new names.
- **Migration** on `questions`: rename the payload key `matchScoringMode` → `scoringMode`, and the values `partial` → `per_item`, `all_or_nothing` → `one_off`. `down` reverses it for match rows.
- **Docs:** the `DOCUMENTATION.md` match section, notes-group `scoring:` values and key-fix grading-settings list. CLAUDE.md's "Live answer-key fixes overwrite manual overrides" tradeoff: "adjusted `match` partial credit" becomes "adjusted `per_item` credit on a sort or match question". The `/guide` text goes in ticket 04, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] No `matchScoringMode`, `partial` (as a mode) or `all_or_nothing` remains outside the alias read and the migration
- [ ] Match scoring results are unchanged: the existing scoring, auto-grading and live-edit regrade tests pass after the rename alone
- [ ] Import reads `scoring: "partial"` / `"all_or_nothing"` as `per_item` / `one_off`; the CSV round trip writes only the new names
- [ ] A DB-backed migration spec (prior art: the retype-media-questions spec) seeds match payloads with both old values and none, plus a non-match row, and asserts the rewrite
- [ ] The editor's match picker shows the new labels and saves `scoringMode`
- [ ] `DOCUMENTATION.md` and CLAUDE.md updated as above
