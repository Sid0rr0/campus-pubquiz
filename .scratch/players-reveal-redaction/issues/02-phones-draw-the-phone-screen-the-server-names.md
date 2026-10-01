# 02: Phones draw the phone screen the server names

**What to build:** The players view names the screen a team's phone shows, as a `phoneScreen` with a `kind`. `/play` draws by that kind instead of working it out from status, leaderboard, answerability and showdown checks. Teams see exactly the same screens as today.

The kinds and their precedence are in the spec, section "Phone screen kind":

- `leaderboard`
- `block` (carrying the question the big screen is revealing)
- `lobby`, `rules`, `round_overview`
- `round_title` (carrying the title)
- `ended`
- `showdown_guessing`, `showdown_reveal`

`phoneScreen` replaces `onScreenQuestionId` and `roundTitleCard`. On `showdown_guessing`, the phone still picks the guess form or the "Tiebreaker in progress" message from its own team id, because the players room is one broadcast for every team.

**Blocked by:** 01 (both change the players view and `/play`'s block-review rendering)

**Status:** ready-for-agent

- [ ] The players projection returns one `phoneScreen` kind per case, covering every kind.
- [ ] The players projection covers the precedence edges:
  - board up over an open answerable question → `block`
  - board up over a hidden kahoot question → `leaderboard`
  - Previous into an already-open round's intro → `block`
  - fresh round intro → `round_title`
  - ended without a showdown → `ended`
  - ended with a showdown → `showdown_guessing` at step 0, `showdown_reveal` above 0
- [ ] `/play` switches on `phoneScreen.kind` with an exhaustive never-check; the status chain in the game-status screens and the page's block-browser condition are gone.
- [ ] The existing `/play` tests pass with their on-screen assertions unchanged; only their snapshot fixtures change (`phoneScreen` in, `onScreenQuestionId` / `roundTitleCard` out).
- [ ] Auto-advance still follows the reveal walk, reading the on-screen question from the `block` kind.
- [ ] `CONTEXT.md` gains a **phone screen** entry; `DOCUMENTATION.md` says the players view names the phone screen.
- [ ] Check whether the block-review status group still has frontend callers; delete it if not.
