# 06: Ended screen names the winning side

**What to build:** When a session played with Versus ends, the big screen's ended screen names the winning **Side** ("Law wins"), or says it's a tie, alongside the final side bar (see the [spec](../spec.md)). Nothing is recorded: the result comes from the side standings, so if scores change after the end, the winner is recomputed.

- **Display view:** the ended screen's description carries the side standings (the lead and the tie flag come from the module in ticket 04).
- **Ended screen:** the winner line (or tie) and the bar. Nothing with Versus off.

**Blocked by:** 05

**Status:** done

- [ ] The ended screen's display view carries the side standings with Versus on, nothing with it off (gateway spec)
- [ ] A grade changed after the end that flips the leading side changes the winner shown
- [ ] The ended screen shows "<side> wins" for a single leader and a tie line for a tied lead (display component test, following `ended-moment.test.tsx`)
- [ ] `DOCUMENTATION.md` updated
