# 01: Each type's scoring modes come from one table, which the schemas and the CSV error also read

**What to build:** Quiz writers see the same modes, defaults and points as today. The one visible change: a bad `{scoring: …}` value on a CSV row now lists only the modes the row's type accepts. A match row names `per_item` and `one_off`; a sort row still names all three. Under the hood, one table in the scoring-mode module (shared types) lists each type's modes, default first, as the [spec](../spec.md) describes.

- **The table** is keyed by question type. Sort maps to `one_off`, `exact`, `per_item`; match maps to `per_item`, `one_off`. The separate match and sort mode constants are deleted, and no other module names a per-type mode list.
- **The registry entry's `scoringModes`** reads its value from the table. The table stays in the scoring-mode module because the registry imports the schemas, so the schemas can't import the registry.
- **The sort and match payload and preview schemas** build their `scoringMode` enum from that type's entry in the table.
- **The CSV import's invalid-scoring message** lists the modes of the row's type. The notes-group parser still recognises any known mode name and the legacy match aliases (`partial`, `all_or_nothing`). The schema still refuses a mode the type doesn't accept.
- The guide text for this spec goes in ticket 03, not here.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The question-kind parity test has a case per type and mode: every mode the table lists for a type is accepted by both the import path and the draft-save path, and every known mode it doesn't list is refused by both
- [ ] A match row with `{scoring: "bogus"}` reports an issue naming `per_item` and `one_off` only; a sort row names all three
- [ ] Defaults are unchanged: the Answer key still resolves an unset mode to the type's first-listed one (sort `one_off`, match `per_item`)
- [ ] The match and sort mode constants are gone; `pnpm typecheck` and `pnpm test` pass
