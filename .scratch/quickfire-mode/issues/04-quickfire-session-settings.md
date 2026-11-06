# 04: Quickfire sessions drop jokers, power-ups, coins and leagues

**What to build:** A session of a quickfire quiz has no jokers, power-ups, coins, coin awards or league; the forms hide them and the server refuses them.

Parent spec: `.scratch/quickfire-mode/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Server refuses, for a quickfire session: `jokersEnabled` or `powerUpsEnabled` true, starting coins, a coin award, and adding the session to a league (at creation and later). No carried coins are granted (follows from no league, check it).
- [ ] Start dialog and lobby settings for a quickfire quiz hide jokers, power-ups, coins and the league picker, and always show the question timer (prefilled 30 s).
- [ ] Session picker shows a "Quickfire" label.
- [ ] Bonus awards, showdown, final-form feedback and the fastest-correct-answer fun fact still work (existing specs, renamed).
- [ ] `DOCUMENTATION.md` (settings, power-ups, leagues) and `/guide` updated.
