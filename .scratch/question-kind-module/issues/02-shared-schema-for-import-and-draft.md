# 02: Import and draft save share one schema

**What to build:** Import decodes each row and then validates it with the entry's schema; draft save validates with the very same schema, replacing the second validation union. Where the two disagreed, the stricter rule wins. A quiz that previews cleanly in import can no longer fail on save.

The sheet parser keeps owning tokenising, headers, round grouping and forcing `break_after` on the last round. Import error messages keep naming the row and the field.

**Blocked by:** 01 (Registry skeleton with parity and characterization table).

**Status:** ready-for-agent

- [ ] Import and draft validation use one schema per type; the second validation union is deleted
- [ ] The named divergences in the parity table now assert identical verdicts and messages on both paths (stricter rule)
- [ ] A quiz that passes import preview also passes draft save, for every type, in the parity table
- [ ] Import errors for a bad row still name the row and field, and an unknown type gives a clear per-row message
- [ ] Existing import and draft specs pass; any spec that exercised the looser path gains the stricter case instead of being loosened
