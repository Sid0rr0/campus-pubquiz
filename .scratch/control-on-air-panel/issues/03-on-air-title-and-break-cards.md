# 03: Title card and break card for the item on air

**What to build:** When a round title card or a break is on the big screen, the detail column shows that card instead of a question. A title card shows its kind (Round intro, Reveal intro, Break review: round intro), the round number and title, category, author and the Round note (on every kind, including the reveal intro). A break card shows "Break N", with "(final)" on the final break. The grading list is hidden while a card is shown. The Round note no longer appears in the browser rows.

To feed this, each round in the `GET /quizzes` round list gains `category` and `author` (absent when the round has none), and `breakNumber` and `isFinalBreak` on block-ending rounds, built by the server with the shared block helpers `/display` uses. The last round always ends a block, so it carries break fields even when its stored break-after is false. The browser's B marker is shown wherever a round has break fields, which makes the final break's B appear.

The on-air item comes from the existing admin indicators; in break review the on-air title card wins over the lit break indicator. Screens with no card (lobby, rules, round overview without a title card, joker pick, leaderboard, showdown, ended) keep today's fallback.

**Blocked by:** 02

**Status:** done

- [ ] `QuizService.list()` returns category/author when set and break fields on block-ending rounds, including the last round with break-after false (`quiz.service.spec.ts`)
- [ ] On-air round intro, reveal intro and break round intro each show the title card with the right kind label and all round fields
- [ ] On-air break shows "Break N", and "(final)" on the final break
- [ ] No grading list while a card is shown
- [ ] Round note absent from browser rows, present on the title card (`question-browser-notes` tests updated)
- [ ] Last round's B marker shown
- [ ] `DOCUMENTATION.md` updated: Round note placement and the new `GET /quizzes` round fields
- [ ] Guide text for this change goes to ticket 05
