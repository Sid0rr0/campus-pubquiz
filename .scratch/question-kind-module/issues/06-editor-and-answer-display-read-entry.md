# 06: Editor and answer/display select by entry

**What to build:** The quiz editor's type picker, its per-type sections, and its type-change behaviour (dropping fields the new type doesn't use) are driven by the entry, as are the phone answer input and the display. Components stay per-kind, but selection comes from the entry's declared input kind, so adding a new type is one entry plus its component and touches no other file.

Layouts are not redesigned.

**Blocked by:** 04 (CSV encode and decode live in the entries, with a round-trip test).

**Status:** ready-for-agent

- [ ] The editor's own question type list is deleted; the type picker lists exactly the registry's types
- [ ] Editor sections and the phone answer input are chosen from the entry's input kind
- [ ] Changing a question's type in the editor drops the fields the new type doesn't use
- [ ] Existing frontend specs for the editor, answer form and display pass unchanged
- [ ] Adding a type requires one registry entry plus its own input/display component; no other per-type switch needs editing, confirmed by a typecheck on a deliberately added stub entry that is then removed
