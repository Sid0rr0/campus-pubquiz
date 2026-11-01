# 09: Extra joker

**What to build:** double the next round for a team.

- Can be bought until the next round's intro goes on air, at any point in the flow, mid-block included.
- Phone copy: "Double the next round: *Title* — N coins" with the round overview on, "Double the next round: Round N — N coins" with it off.
- Refused for a round already doubled (the joker round or an earlier extra joker). Works with Jokers off.
- Scoring: answer points in that round count double, the same as the joker round. Bonus awards never double.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 04

**Status:** done

- [x] Real-Postgres spec: purchase window, refusal on a doubled round, leaderboard doubling
- [x] Joker-round changes by the quiz master can't stack with an extra joker on the same round
- [x] Phone offer between rounds, Vitest
- [x] `DOCUMENTATION.md` jokers section
