# Coding standards

The rules every change to this repo follows. Implementers write to them; `/code-review` checks a diff against every one. Rules marked **(lint)** are also enforced by ESLint (`eslint-rules/question-kind.mjs`), so a review only needs to check what the selectors can't see, such as a type check routed through a variable not named `type`.

## Game state

- **The backend owns game state.** Only admin actions (`ADVANCE`, `PREVIOUS`, …) move it. Clients render what they're sent and do no game logic themselves. Each room (`display`, `admin`, `players`) gets its own server-built view, and anything teams mustn't see yet is removed on the server before it's sent.
- **Reconnection is a core feature.** A client that reconnects receives the full current view for its role. Phones sleep and venue networks drop, so every change that touches state builds and tests the resync path alongside the live path.
- **A Live session event checks, writes and changes the session inside its session write.** The check that says whether the event is allowed (is the question still answerable, does the socket own the seat), every database write it makes and the change to the session all run inside the change handed to the session write, against the session as the previous write left it. A refusal is thrown before any database write, so a refused event stores nothing. A shared step (like the answer refresh) is a private helper that builds a change, never a write of its own: a write must not call another public event method.
- **The leaderboard is a flag, not a status** (`isLeaderboardVisible`), so hiding it resumes exactly where the quiz was.

## Quiz data

- **Quiz structure is data.** Breaks come from each round's `breakAfter`, and the rules screen's structure sentence is computed from the quiz's rounds. Both are derived at runtime from the quiz.
- **Question types are defined once**, in the question type registry (`QUESTION_KINDS`, `shared/types/src/question-kind.ts`). Grading mode, overridability, kahoot eligibility, input kind and the rest are read from the entry or a `scoring.ts` helper (`isBatchGradedType`, `resolveAnswerKind`, …). When behaviour differs by type and no field covers it, add a field to `QuestionKind`. **(lint)** bans `.type === '<literal>'` and `case '<literal>':` on `.type` outside tests. Behaviour that differs by how a question is answered goes in the answer format (`ANSWER_FORMATS`, `shared/types/src/answer-kind.ts`) or a surface's answer-kind map, never in a branch on sort, match or choices; get the kind from `resolveAnswerKind`.

## Boundaries

- **Validate everything at the boundary.** Imported rows and saved drafts go through the per-type Zod schema; a bad row fails at import, not live on stage.
- **Stored JSON payloads are parsed** with `parseQuestionPayload`. **(lint)** bans `.payload as …` and `as QuestionPayload` in backend code outside tests.
- **Uploads are untrusted.** Media type is sniffed from magic bytes, storage keys are server-generated UUIDs, and media providers sit behind the `MediaStorage` interface.
- **A socket event is declared once, in the socket protocol map;** both ends emit and listen through sockets typed by it, never with a hand-written payload type. A field only one room reads goes in that room's view, not the shared snapshot.
