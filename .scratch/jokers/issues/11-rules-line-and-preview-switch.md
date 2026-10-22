# 11: Rules screen line and quiz preview switch

**What to build:** When Jokers is on, the rules screen (big screen and phones) carries a line: "Joker: pick one round to score double. You'll choose after the round overview." The Quiz preview gains a "with jokers" switch, off by default; on, its "like the night" order includes the joker pick after the overview, with no teams ("0/0 picked") and no timer running out.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 02

**Status:** done

- [x] Rules screen joker line only when Jokers is on
- [x] Quiz preview "with jokers" switch, off by default; on, `joker_pick` appears after `round_overview` in the preview order
- [x] Page specs and Quiz preview specs
- [x] `DOCUMENTATION.md` (rules, Quiz preview) updated
