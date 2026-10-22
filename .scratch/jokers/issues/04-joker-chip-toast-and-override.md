# 04: Joker chip, change toast and the quiz master's override

**What to build:** Every phone with a joker carries a joker chip in its actions bar ("🃏 R4"); tapping it explains which round scores double. The quiz master can change any team's joker from `/control` until that round has started. When a team's joker changes without that team picking it (the quiz master's change, a draw), the phone shows a one-off toast saying so; a reconnect only updates the chip.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 02

**Status:** done

- [x] Actions bar joker chip whenever the team has a joker, with an explanation on tap
- [x] `SET_TEAM_JOKER` (admin) `{ teamId, roundId }` as a Session write that touches scores; refused for a round with an opened question or a team not in the session; the source becomes `set_by_quiz_master`
- [x] `/control` lets the quiz master pick a team's joker round from the joker list
- [x] A team sync event pushes the team's joker when it changes without its own pick; the phone shows a toast ("…changed by the quiz master", "…drawn for you") on the live sync only, never on a state sync
- [x] Real-store harness specs (accepted, refused, sync only to that team) and page specs (chip, toast live-only)
- [x] `DOCUMENTATION.md` protocol and `/guide` (changing a team's joker) updated
