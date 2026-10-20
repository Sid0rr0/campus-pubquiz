# 01: Infer the preview and stored payload types from their schemas

**What to build:** The preview type (what the quiz editor and import work with) and the stored payload type are taken from their validation schemas instead of being written out beside them. A field added to a schema reaches its type without a second edit, and the two can't drift. The match scoring mode's values are declared once and used by the schemas, the payload and the question views. Nothing changes for users. This is a prefactor so tickets 02 to 05 work against one source of truth.

Parent spec: `.scratch/question-record-module/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The preview type is inferred from the per-type preview schemas' input shape (never their output, which could carry defaults filled in by validation), under its existing name.
- [ ] The stored payload type is inferred from the per-type payload schemas under its existing name. Payload parsing still drops keys a type doesn't read.
- [ ] If an inferred per-type union breaks more call sites than is reasonable, the module exports a merged, all-optional shape derived from the schemas instead. Either way, no hand-written field list remains.
- [ ] The match scoring mode's values (`partial`, `all_or_nothing`) are declared once; no other place writes them out.
- [ ] The question kind parity test still checks that every registry type has a preview schema and a payload schema.
- [ ] No behaviour change: typecheck, lint and all tests pass with fixture-shape updates only.
