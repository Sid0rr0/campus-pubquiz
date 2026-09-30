# 07: Quiz editor: kahoot type picker and toggle guard

**What to build:** In the quiz editor, a round with kahoot mode on offers only kahoot-allowed types (from the Scoring module) in each question's type picker. New questions default to an allowed type, as today. While a round holds any disallowed question, its kahoot mode toggle can't be switched on, and a short hint names the blocking questions by their position in the round. The toggle enables as soon as none remain. Turning kahoot mode off is always allowed and restores the full picker. Question types are never changed automatically. The existing save-blocking validation remains as a backstop. See [spec](../spec.md) user stories 10–13 and ADR 0001.

**Blocked by:** 01

**Status:** done

- [x] Component tests through the quiz editor panel: with kahoot mode on, a round's pickers show only multiple choice, sort and match, and other rounds are unaffected.
- [x] A round holding a free_text question has its kahoot toggle disabled with a hint naming that question. Changing the question to an allowed type, or deleting it, enables the toggle.
- [x] Turning kahoot mode off restores all types in that round's pickers.
- [x] The toggle and hint are accessible: the disabled state is exposed, and the hint is linked to the toggle.

## Comments

Implemented in `feat(frontend): filter kahoot round types and guard the kahoot toggle`. Status set to `done`.

- Pickers in a kahoot round use Scoring's `isKahootAllowedType`. A question that already holds a disallowed type (only possible in a quiz loaded in that state) keeps its current type visible so the UI doesn't hide it; save validation still flags it.
- The blocked toggle's hint (`Kahoot rounds only hold multiple choice, sort and match — change or remove question N first.`) is referenced from the toggle via `aria-describedby`, alongside the existing sr-only description.
- Tests are in `quiz-editor-panel.test.tsx`.
