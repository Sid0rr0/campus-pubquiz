# 07: Carried coins

**What to build:** A journey over two sessions in one league: a team that rated every round of the first night spends its carried coins in a second night with power-ups off.

Parent spec: `.scratch/e2e-power-ups/spec.md`

**Blocked by:** 01

**Status:** done

- [x] The team that rated every round comes back with its recovery code to two coins and a shop, and can buy.
- [x] The team that didn't rate gets no shop.
- [x] Check first whether the final form takes ratings after `END_QUIZ` on an unplayed night; if not, the first night is played through. (It does take them, but the night only counts for teams that answered, so each team answers question 1 before the quiz is ended.)
- [x] Passes `--repeat-each=5`.
