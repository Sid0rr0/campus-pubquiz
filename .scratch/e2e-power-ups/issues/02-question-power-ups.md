# 02: Question power-ups

**What to build:** A journey where one team buys 50/50, first letter, letter count, pin one and wider margin in round 1.

Parent spec: `.scratch/e2e-power-ups/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] 50/50 leaves the right option and two of four.
- [ ] First letter and letter count show their hints for the key.
- [ ] Pin one shows one 📌 and a disabled drag handle on both the sort and the match.
- [ ] Wider margin bought after submitting 215 (key 200, 5%) is marked right at reveal, with no second submit.
- [ ] After a phone reload the same options stay removed and the same item stays pinned.
- [ ] `/control` shows the power-up labels on the answers; `/display` shows the counts at reveal.
- [ ] Snapshots: phone `question_open` shop drawer, `/control` `question_open`, `/display` `reveal`.
- [ ] `power_up_fifty_fifty`, `power_up_first_letter`, `power_up_letter_count`, `power_up_pin_one`, `power_up_wider_margin` are in `MOVES` and recorded.
- [ ] Passes `--repeat-each=5`.
