# 02: Wrong answers, ungraded answers and unplayed questions in the brief

**What to build:** what went wrong on each question, added to the brief's question blocks.

- **`free_text` and `number`:** the top 3 incorrect answers with counts, grouped like topics (trim, collapse whitespace, ignore case, most common spelling), ties alphabetical. Partial answers aren't wrong answers.
- **`multiple_choice`:** every option in stored order with its pick count, the correct one marked.
- **`closest_guess`:** the lowest, median and highest guess beside the key.
- **`sort` and `match`:** nothing added.
- **Ungraded answers:** grouped the same way, on their own line, never among the wrong answers.
- **"Not played":** questions the session never reached, as the spec defines them. A reached question nobody answered reads "0 answered".

Parent spec: `.scratch/night-brief/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Pure calc tests for each type's line, including grouping across spellings and ties
- [ ] Ungraded answers listed apart (session force-ended mid-block)
- [ ] "Not played" vs. "0 answered"
- [ ] `DOCUMENTATION.md` Night brief subsection updated
