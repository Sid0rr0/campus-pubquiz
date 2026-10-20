# 02: The block Phone screen says whether it is answering, locked or revealing

**What to build:** A team's phone shows exactly what it shows today in the block browser:

- the question and the answer form while the block is answerable;
- "Answering is locked for this question" in a break;
- the revealed answer, or "Revealing answers…" for a question the big screen hasn't reached, in reveal.

It gets there from the server, not from game status. The `block` Phone screen carries a mode (`answering`, `locked` or `revealing`) next to the question the big screen is revealing. `/play` draws the block browser from the mode alone, so a change to what a phone shows in break or reveal is one change in the Screen projection.

Parent spec: `.scratch/display-screen-content/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] The `block` Phone screen carries `mode`:
  - `answering` while the block is answerable;
  - `locked` in break and break review;
  - `revealing` from the reveal intro through reveal.
  It keeps the question the big screen is revealing.
- [ ] The block browser chooses the reveal body, the answer form, and the locked and revealing lines from the mode. It no longer checks game status, the break status group or the revealing status group.
- [ ] Screen projection specs cover the mode in answering, break, break review, reveal intro and reveal, including a kahoot question hidden behind the leaderboard.
- [ ] `/play` specs render the block browser in each mode from projected fixtures.
- [ ] If the phone's block-review status group has no callers left, it is deleted.
- [ ] GLOSSARY.md **Phone screen** says the `block` kind carries its mode.
- [ ] Typecheck, lint and tests pass.
