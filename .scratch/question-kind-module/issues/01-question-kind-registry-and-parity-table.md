# 01: Registry skeleton with parity and characterization table

**What to build:** One entry per question type in the shared types workspace, wrapping today's schemas and grading flags **unchanged**, so behaviour for every valid quiz is identical. There is a single definition of the list of question types that every workspace can import, and a question type with no entry is a compile error rather than a live crash.

A table-driven spec in the shared types workspace runs one shared table of valid and invalid questions, per type, through both the import path (decode, then schema) and the draft path (schema), and records the verdict of each. It also pins each type's grading mode, overridable flag and kahoot-allowed flag to today's values (free_text auto-graded but not kahoot-allowed per ADR 0001; closest_guess batch-graded and not overridable; audio/youtube human-graded). The two known disagreements between import and draft validation (duplicate multiple-choice options, match pairing) are included as explicit, named divergences so ticket 02 has something to flip.

**Blocked by:** None (can start immediately).

**Status:** ready-for-agent

- [ ] Every question type has a registry entry, and a type missing an entry fails the build
- [ ] There is one definition of the question type list; the import and quiz editor lists are not yet removed but point at or are checked against it
- [ ] The parity table covers every type with valid and invalid cases and runs through both the import and draft paths
- [ ] The duplicate multiple-choice option and match pairing disagreements appear as named divergences in the table
- [ ] Grading mode, overridable and kahoot-allowed per type are asserted equal to today's values, including free_text not being kahoot-allowed
- [ ] All existing import, draft, scoring and grading specs pass unchanged
