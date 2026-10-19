# 01: The margin text explains itself

**What to build:** While a Number question is open, the big screen and the phone word its margin as a sentence: "Answers within 5% of the real number count as correct", "Answers within 5 of the real number count as correct" for an absolute margin, and "Exact answer only" for a margin of 0. At reveal the line reads "200 (anything from 180 to 220 counts)", or just "200" for a margin of 0. Both screens keep reading the one shared margin formatter.

Parent spec: `.scratch/display-portrait-margin/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [x] Percent, absolute and margin-0 wording while asked, on both the big screen and the phone.
- [x] Reveal line in the new wording; margin 0 shows the key alone.
- [x] Numbers still show at most 2 decimals with trailing zeros dropped; grading unchanged.
- [x] Margin formatter unit tests cover every case above; existing tests asserting the old wording are updated.
- [x] DOCUMENTATION.md's Number question section quotes the new wording (and `/guide` if it quotes the old).
