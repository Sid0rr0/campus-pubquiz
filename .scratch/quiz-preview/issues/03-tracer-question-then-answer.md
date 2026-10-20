# 03: Quiz preview, question → answer order, end to end

Status: ready-for-agent

Spec: [Quiz preview](../spec.md)

**What to build:** A quiz master clicks Preview in the quiz editor and steps through the saved quiz's screens in a 16:9 frame: each round's title card, then each question followed by its revealed answer, with a "block ends here" marker after each block's last question. Nothing is stored and no session exists.

- **Quiz preview module** (pure, `shared/types`): takes the seeded rounds and a mode and returns ordered steps, each with its `DisplayScreen`, its position (round and question indexes) and whether a block ends after it, plus the quiz-level display context ticket 02's component needs. It builds a team-less, in-memory session from the seeded rounds and gets every screen through the existing display projection, never building a `DisplayScreen` by hand. This ticket implements the `answer_after_question` mode only: `round_title`, `question` and `reveal` steps. Kahoot rounds look the same. Fun facts are off; a closest_guess reveal is at its single "nobody guessed" step, so it shows the correct answer.
- **Endpoint** `GET /quizzes/:id/preview?mode=…`: same session and role guards as the other quiz reads (admin and moderator). Unknown quiz is a 404, an invalid mode a 400 (Zod at the boundary; the mode defaults to `answer_after_question`, and `night` is added by ticket 04). Payload type in `shared/types`.
- **Page** `/quizzes/[id]/preview`: draws each step with ticket 02's shared component inside a letterboxed 16:9 frame, with Prev/Next buttons and arrow keys, the block-end marker, and a not-found state. Media plays as on the night (clip bounds, YouTube, `hideVideo`).
- **Entry:** a Preview button in the quiz editor; with unsaved changes it prompts before opening.
- **Docs:** `DOCUMENTATION.md` gets the route table row and the endpoint.

**Blocked by:** 01, 02.

- [ ] Module tests (game-state fixtures): a multi-block quiz gives title card, question, reveal, … in order with the block-end marker on each block's last question; a kahoot round; closest_guess shows only its answer; `hideVideo` and clip bounds carried through; no team counts, guesses, fun facts or break deadline; an empty quiz and an empty round give no error.
- [ ] Endpoint tests over the test database: admin and moderator allowed, logged out refused; 404 unknown quiz; 400 bad mode; steps reflect the saved quiz; no `game_sessions` (or any other) row written and no in-memory session added.
- [ ] Page tests: steps drawn by the shared display component; Prev/Next and arrow keys move one step and stop at the ends; not-found state.
- [ ] Editor test: Preview with unsaved changes prompts; without, it opens the preview.
- [ ] `DOCUMENTATION.md` updated.
