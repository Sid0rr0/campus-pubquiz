# 03: Persistence parses stored payloads instead of casting

**What to build:** Reading a question's stored JSON goes through the entry's payload codec instead of a cast, so a malformed or old row fails loudly when the quiz loads or is edited (logged, naming the question) rather than midway through a live game. The three duplicate payload interfaces in the answer, quiz and seed code are deleted in favour of the registry's payload type.

No schema or data migration: existing saved quizzes keep loading.

**Blocked by:** 01 (Registry skeleton with parity and characterization table).

**Status:** ready-for-agent

- [ ] The answer, quiz and seed code read the payload column through the entry's codec; no `as` cast of the payload remains
- [ ] The three duplicate payload interfaces are deleted
- [ ] For each type, the codec accepts valid stored JSON and rejects malformed JSON, covered by the registry spec
- [ ] A malformed stored payload produces a logged error naming the question, and does not silently pass through
- [ ] Existing saved quizzes still load, verified by the real-store gateway specs passing unchanged
