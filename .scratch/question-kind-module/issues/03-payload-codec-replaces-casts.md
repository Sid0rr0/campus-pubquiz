# 03: Persistence parses stored payloads instead of casting

**What to build:** Reading a question's stored JSON goes through the entry's payload codec instead of a cast, so a malformed or old row fails loudly when the quiz loads or is edited (logged, naming the question) rather than midway through a live game. The three duplicate payload interfaces in the answer, quiz and seed code are deleted in favour of the registry's payload type.

No schema or data migration: existing saved quizzes keep loading.

**Blocked by:** 01 (Registry skeleton with parity and characterization table).

**Status:** done

- [x] The answer, quiz and seed code read the payload column through the entry's codec; no `as` cast of the payload remains
- [x] The three duplicate payload interfaces are deleted
- [x] For each type, the codec accepts valid stored JSON and rejects malformed JSON, covered by the registry spec
- [x] A malformed stored payload produces a logged error naming the question, and does not silently pass through
- [x] Existing saved quizzes still load, verified by the real-store gateway specs passing unchanged

## Comments

Implemented in a single commit (see git history for the hash).

- Each `QUESTION_KINDS` entry carries a `payload` codec (`question-payload-schema.ts`), and `parseQuestionPayload(type, stored)` (`question-kind.ts`) parses stored JSON with it, throwing an error that names the type and the bad fields. Backend code reads rows through `readQuestionPayload` (`apps/backend/src/db/question-payload.ts`), which logs `Question <id> has an unreadable <type> payload` and rethrows.
- The three `QuestionPayload` interfaces in the answer, quiz and seed services are gone (the registry's `QuestionPayload` type replaces them), as is the seed's hand-rolled `toViewPayload` picker: the codec drops keys a type doesn't read, so a stored correct answer still can't reach a QuestionView.
- The codecs check shape only. Which option lists a type requires stays with the preview schemas, because the existing answer specs store a `multiple_choice` question with an empty payload and must keep passing unchanged. Clip times (`mediaStartSeconds`/`mediaEndSeconds`) are kept for every type, since quiz save derives them from any YouTube link.
- A field of the wrong type (e.g. `mediaUrl: null`) now fails the load where the old cast read it as-is; quiz save never writes such values.
