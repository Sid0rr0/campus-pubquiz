# 01: Margin travels on the question view

**What to build:** A question view carries a margin if and only if its type has one, already resolved. The big screen and the phone show margin text from the view alone, never asking the question type registry. Teams and the room see exactly the margin text and accepted range they see today.

- **The projection that strips the answer from a question** includes the margin for every type the registry marks as having one. It takes the margin from the Answer key's grading settings (answer-key ticket 01), so an older Number question with no stored margin is sent with the default margin. Every other type, closest_guess included, is sent without a margin, as today. The projection doesn't apply the default margin itself.
- **The margin field's meaning on the question view** becomes "this type is graded within this margin" instead of "Number only, undefined means the default". Update its doc comment and the socket event schema that describes it.
- **The big screen's question body for the `number` answer kind** shows margin text when the view has a margin, and nothing otherwise.
- **The big screen's reveal body for the `number` answer kind** shows the answer with its accepted range when the view has a margin, and the plain answer otherwise (closest_guess).
- **The phone's open-question prompt** shows margin text when the selected question has a margin.
- **The /display and /play screens no longer import `hasMarginType`.**
- **Overlap with answer-key ticket 03.** That ticket touches the same margin text and Number reveal. Whichever ticket lands second rebases onto the other. Once this ticket is done, the screens read a margin that is already resolved, so answer-key 03 only has to remove any leftover screen-side default.

Parent spec: `.scratch/reveal-kind/spec.md`

**Blocked by:** answer-key 01 (the Answer key module, `.scratch/answer-key/issues/01-answer-key-and-live-edit-guard.md`). Not blocked by any reveal-kind ticket, so it can run in parallel with 02.

**Status:** done

- [ ] A backend projection spec asserts that a Number question's view carries its stored margin, and the default margin when none is stored, both while the question is open and on its reveal view.
- [ ] The same spec asserts that closest_guess and at least one other type never carry a margin, even if one was left on the stored question.
- [ ] Display tests: margin text appears on the big screen's question and the range on its reveal exactly when the fixture view has a margin. A closest_guess reveal shows the plain answer.
- [ ] Play tests: margin text appears on the phone's open prompt exactly when the fixture view has a margin.
- [ ] No file under the /display or /play screens imports `hasMarginType`.
- [ ] DOCUMENTATION.md says the question view carries a margin exactly for types that have one, wherever it describes the view.
- [ ] `pnpm typecheck`, `pnpm lint` and `pnpm test` are green.
