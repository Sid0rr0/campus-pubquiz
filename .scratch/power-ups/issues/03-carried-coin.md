# 03: Carried coin

**What to build:** a team that rated every round of its last ended session sharing a league with this one brings 1 coin.

- Decided at `START_QUIZ` for teams on the roster, and at join for later teams. Stored so a later league change doesn't remove it.
- "Rated every round" means a round rating for each round of that session, from the break or the final form. Other feedback doesn't count.
- No league means no coin. With two leagues, it looks at the last ended session sharing either one.
- With power-ups off, a team with coins still sees the shop (the session's power-up table). Teams without coins don't.

Parent spec: `.scratch/power-ups/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Real-Postgres spec: the night A / missed B / non-league N / night C scenario from the grilling (coin on C, none on N)
- [x] Late join gets it, a league removed after start doesn't take it away
- [x] Power-ups off: shop only for the coin holder (no shop exists yet: the coin and its balance reach only holders; the shop ticket must show the shop when `coins > 0` with power-ups off)
- [x] `DOCUMENTATION.md`, phone copy explaining where the coin came from
