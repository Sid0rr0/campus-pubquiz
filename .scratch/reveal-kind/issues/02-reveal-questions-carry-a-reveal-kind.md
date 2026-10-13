# 02: Reveal questions carry a reveal kind

**What to build:** Every reveal question the server sends says how it is revealed: `answer`, `closest_guess` or `closest_guess_pending`. The big screen and the phone switch on that reveal kind instead of re-deriving it from the question type. Every reveal step, answer and closest-guess stat appears on the big screen and the phones exactly as today.

- **The reveal question views become a discriminated union on the reveal kind.**
  - The `answer` kind is the block question view plus the correct answer and optional answer media. It has no closest-guess stats.
  - The `closest_guess` kind adds the closest-guess stats. When nobody guessed, those are the "no submissions" stats, as today.
  - The `closest_guess_pending` kind is the block question view plus the stats shown so far. It has no answer and no answer media, and it replaces today's pending closest-guess reveal view.
  - The block reveal view (sent to /display and the admin views) is `answer` or `closest_guess`. The players view's reveal questions can be any of the three.
- **The seeded question isn't a reveal view.** Remove the optional closest-guess field from the seeded question shape. The stats exist only on the `closest_guess` kinds.
- **The step that dresses the block's and past blocks' reveal questions** decides the kind once from the registry (batch grading mode → `closest_guess` with the cached stats, any other mode → `answer`). Nothing else maps a type to a reveal kind.
- **The players-view redaction** produces `closest_guess_pending` before the on-air closest_guess question's answer step, and `closest_guess` with trimmed stats from the answer step on. A question nobody guessed on is sent whole as `closest_guess`, and so is the `ended` reveal walk, as today.
- **/display's reveal screen** switches exhaustively on the kind: the closest-guess sequence for `closest_guess`, the ordinary question display for `answer`. It no longer imports `isBatchGradedType`.
- **The phone's question browser** switches exhaustively on the kind. Both closest-guess kinds draw the closest-guess sequence, but only `closest_guess` passes the correct answer and answer media. `answer` draws the ordinary question display. The `'answer' in …` and `'answerMediaUrl' in …` checks and the `isBatchGradedType` import go. The "Your answer" and points lines are unchanged.
- **The socket event schemas** that describe the reveal views are updated with them. Both apps deploy together, so there's no compatibility shim.
- **GLOSSARY.md:** add **Reveal kind**: "How the screens reveal a revealed question: `answer` (the question with its correct answer, laid out by its answer kind), `closest_guess` (the step-by-step closest-guess reveal) or `closest_guess_pending` (players view only: a closest_guess question whose answer step isn't on air yet, so no answer). Decided once by the Screen projection from the question type registry." _Avoid_: reveal type, reveal mode.
- **DOCUMENTATION.md:** wherever it describes the reveal views or the players-view redaction, describe them in terms of the reveal kind.

Parent spec: `.scratch/reveal-kind/spec.md`

**Blocked by:** None (can start immediately). Independent of 01.

**Status:** done

- [ ] Backend projection specs (closest-guess reveal, players reveal redaction, reveal paging, session snapshot leak) assert:
  - every non-closest_guess reveal question is `answer` with no stats
  - a closest_guess question is `closest_guess` in the display and admin views at every step
  - the players view has `closest_guess_pending` with no answer or answer media before the answer step, and `closest_guess` with trimmed stats from it on
  - a closest_guess question nobody guessed on is `closest_guess` at step 0
  - past blocks' revealed questions and the `ended` reveal walk carry the right kinds
- [ ] Display tests render fixtures of each block reveal kind: the closest-guess sequence for `closest_guess`, the question with its answer for `answer`.
- [ ] Play tests render fixtures of all three kinds. `closest_guess_pending` shows the closest-guess sequence with no correct answer, and `closest_guess` shows it with the answer.
- [ ] No file under the /display or /play screens imports `isBatchGradedType` or tests whether a reveal field exists with `in`.
- [ ] The screens' switches on the reveal kind are exhaustive, so a new kind fails typecheck until each screen handles it.
- [ ] GLOSSARY.md and DOCUMENTATION.md are updated.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
