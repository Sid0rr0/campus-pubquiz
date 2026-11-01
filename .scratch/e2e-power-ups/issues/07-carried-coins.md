# 07: Carried coins

**What to build:** A journey over two sessions in one league: a team that rated every round of the first night spends its carried coins in a second night with power-ups off.

Parent spec: `.scratch/e2e-power-ups/spec.md`

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] The team that rated every round comes back with its recovery code to two coins and a shop, and can buy.
- [ ] The team that didn't rate gets no shop.
- [ ] Check first whether the final form takes ratings after `END_QUIZ` on an unplayed night; if not, the first night is played through.
- [ ] Passes `--repeat-each=5`.
