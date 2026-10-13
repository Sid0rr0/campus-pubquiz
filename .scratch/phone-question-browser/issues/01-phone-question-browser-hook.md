# 01: Phone question browser hook

**What to build:** Browsing on a team's phone moves out of the /play page into a phone question browser hook. Teams see no difference:

- the block browser follows the big screen with auto-advance on
- a tapped question holds until the next question or reveal step
- with auto-advance off the selection holds still, with previous/next that stop at the block's ends
- turning auto-advance on resumes following at once, and turning it off keeps the current question
- the choice is remembered on the phone, on by default before it is read
- during the reveal the selected question shows its correct answer
- history taps jump only to questions in the current block

The /play page is left laying out screens.

See the parent spec: `.scratch/phone-question-browser/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The hook takes the players view (or none, since it is called before /play's early returns) and returns the selected question (none when the phone screen isn't `block`), the reveal question, the navigation (only with auto-advance off), the jumpable question ids, `selectQuestion`, and the auto-advance setting with its setter
- [ ] The browsed pick, the auto-advance setting with its localStorage read after mount and write on change, and the snap-back bookkeeping with its render-time sync all live in the hook; it delegates to the existing pure phone question selection and auto-advance-change rule, unchanged
- [ ] /play holds no browsing state; it keeps the layout, the answered history and the selected question's awarded points
- [ ] New /play test (test-first): with auto-advance off, the navigation survives a re-render that brings a new view for the same question
- [ ] Question navigator, auto-advance setting, break and reveal, answered questions and phone question selection tests pass with unchanged assertions
- [ ] Frontend suite, `pnpm typecheck` and `pnpm lint` pass
