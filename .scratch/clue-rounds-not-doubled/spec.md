# Clue rounds are never doubled

Status: done

Agreed in a grilling session on 2026-11-10. The Clue question was specified as taking "no power-ups", but only the question power-ups were blocked: the extra joker (bought for a round) and the joker could still double a round with a Clue question.

## Rule

A round that has a Clue question is never doubled.

1. **Extra joker:** can't be bought for a Clue round ("Can't be used on this round"). Finished sessions, and sessions live when this ships, keep what they hold.
2. **Joker:** a Clue round can't be a joker round: refused for the team's pick and the quiz master's set, skipped by every draw, left out of the `/control` joker list.
3. **No eligible round:** when Jokers is on but no round can be a joker round as the quiz moves past the round overview, the joker pick is skipped and the rules screen leaves out the Jokers line.
4. **Phone, Extra joker card:** says "Can't be used on Round 3 or Round 5" all session (no mention of Clue questions); when the round on offer is a Clue round the card is disabled with "Can't be used on this round".
5. **Phone, joker pick:** Clue rounds are disabled cards with "Can't be your joker"; the big screen marks the same rounds.
6. **Live edit:** adding a Clue question, or changing an unopened question to Clue (or moving one in), is refused when that round holds an extra joker or is any team's joker round. During an open joker pick, a team's saved choice counts.
7. **Fun facts:** `joker_snubbed_round` skips rounds that can't be a joker round.
8. **Docs:** `GLOSSARY.md` (Joker, Clue question, Extra joker), `DOCUMENTATION.md`, the `/guide` page and `/how-to-play`.
