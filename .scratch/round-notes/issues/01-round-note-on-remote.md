# 01: A round note, written in the editor and read on /remote

**What to build:** A round's note, end to end for the host. It's stored on the round, edited in the quiz editor, seeded into sessions and shown in `/remote`'s Notes panel while that round's intro or break round intro is on air. After this ticket, a quiz master can write intro patter and read it live. Nothing appears on the big screen yet.

- `Round.note` (`text`, nullable), with a migration. `QuizDraft` rounds get an optional `note`. `findDraftById` and save copy it like `category`. `quiz-draft.schema.ts` trims it, stores blank as null and rejects a note over `ROUND_NOTE_MAX_LENGTH` (500, shared types).
- Seeded onto `SeededRound` in `seed.service.ts`. Live edits re-seed, so a fix reaches running sessions. `findLiveEditViolations` ignores the note on every round.
- `PresenterContextPayload.currentRoundNote: string | null`: the note of the round whose intro or break intro is on air, null otherwise (including the reveal intro). It is built in `screen-preview.util.ts` from the on-air screen.
- `/remote`'s Notes panel: question notes when a question is open, the round note on a round intro or break round intro, "No note for this round." when that round has none.
- Editor: the round textarea, with a character count.
- Docs: DOCUMENTATION.md (presenter context / `PRESENTER_CONTEXT_UPDATED`, the quiz editor). `/guide`: writing a round note in the editor and reading it on `/remote`.

See the spec's "Data", "Format", "Draft shape", "Seeding", "Where it shows" and "/remote" decisions.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Backend spec: on the round intro, `currentRoundNote` is the round's note. On the reveal intro and on an open question it's null. Break review across the round intro gives the note.
- [ ] Backend spec: no display or players view carries the note.
- [ ] Backend spec: the draft round-trips the note, a blank note saves as null and 501 characters is a `400`.
- [ ] Backend spec: editing the note of the current or a played round while live is accepted and the session's presenter context shows the new note.
- [ ] `/remote` test: the Notes panel on a round intro, with and without a note.
- [ ] Editor test: the textarea edits the round's note in the draft.
- [ ] `pnpm typecheck`, `pnpm lint`, and the backend/frontend/shared-types tests pass.
