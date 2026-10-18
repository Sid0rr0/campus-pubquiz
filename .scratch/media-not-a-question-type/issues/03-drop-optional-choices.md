# 03: Drop the optional-choices machinery

**What to build:** After 02, no question type has `choices: 'optional'`. Delete what existed only for it, so a question's answer kind comes from its type alone:

- `'optional'` is removed from `QuestionKind['choices']`, which becomes `'none' | 'required'`.
- `withOptionalChoiceRules` and `optionalChoices` are removed from `question-preview-schema.ts`.
- The optional branch is removed from `resolveAnswerKind` (and its doc comment), and the "type plus whether it carries choices" wording is removed from its comments.
- The quiz editor's `hasOptionalChoices` path is removed: `TypedAnswerFields` renders no choice list, and the prop leaves `ChoiceFields`/`ChoiceList`.
- `requiresMedia` and the registry's `hasYoutubeMedia` are removed if nothing but the editor reads them, and the editor's media URL field is then optional for every type.

There is no behaviour change for any remaining type. See the spec's "The optional-choices machinery goes" decision.

**Blocked by:** 02

**Status:** done

- [ ] `resolveAnswerKind({ type: 'free_text', options: ['A', 'B'] })` is `text`, and `multiple_choice` is always `choice` (`answer-kind.test.ts`).
- [ ] The editor shows no choice list on a free text, number or closest guess question (`quiz-editor-panel.test.tsx`).
- [ ] Nothing in the repo references `choices === 'optional'`, `withOptionalChoiceRules`, `optionalChoices` or `hasOptionalChoices`.
- [ ] DOCUMENTATION.md's answer-kind paragraph no longer describes optional choices.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` pass.
