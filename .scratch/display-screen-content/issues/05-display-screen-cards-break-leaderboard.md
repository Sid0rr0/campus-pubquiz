# 05: Round title cards, the break intro and the leaderboard carry what they draw

**What to build:** The big screen's remaining screens get their content from the Display screen instead of working it out in the page:

- **Round title cards** carry the round number, title, category, author and round note as the card shows them, for each place a card appears: `round_title`, `break_round_title` and `reveal_intro`.
- **The break intro** carries:
  - its round number;
  - its break number;
  - whether it is the final break (which hides the bonus list);
  - the feedback prompt flag;
  - the fun facts;
  - the break end time.
- **The leaderboard** carries its board, its reveal count and whether it is the final board (the quiz has ended, or this is the last break, which crowns the winners).

`/display` drops its own break number, last-break and final-board rules, and its round label building from game progress. Every screen looks as it does today.

Parent spec: `.scratch/display-screen-content/spec.md`

**Blocked by:** 04

**Status:** ready-for-agent

- [ ] `round_title`, `break_round_title`, `reveal_intro`, `break_intro` and `leaderboard` carry their content. Fields that move in (fun facts, leaderboard board, break end time, the shown round's title, category, author and note) are no longer sent at the top of the display view. Fields several screens draw (teams, settings, quiz structure, text scale) stay at the top.
- [ ] `/display` reads none of: game progress's round index for a label, the break number helper, the last-break check, or a final-board rule.
- [ ] Screen projection specs cover:
  - a round title card in each of its three places names the right round;
  - break number and final-break flag on the first and last break;
  - the final board after `ended` and in the last break, and not in an earlier break.
- [ ] `/display` render tests for these kinds render from projected views.
- [ ] DOCUMENTATION.md's protocol section describes the Display screen and what each kind carries.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once before the PR (the full-night, kahoot, showdown and media journeys cross every Display screen kind).
