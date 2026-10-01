# 05: Contract: delete the old Advance contract

**What to build:** With every client reading the announced step, remove what's left of the old contract so there is only one way to move the quiz: the old can-advance and can-go-to-previous flags on the admin view, the REVEAL_NEXT_TEAM game action and its handling, and the client's leaderboard step count in the shared admin controls. Record "Move plan" as a domain term in a new root CONTEXT.md.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** 04 (/control and /remote render the announced step and send only ADVANCE/PREVIOUS)

**Status:** ready-for-agent

- [ ] The admin view no longer carries the old Advance/Previous boolean flags; nothing reads them
- [ ] REVEAL_NEXT_TEAM is gone from the game action set, the socket payload validation and the state machine; specs that sent it now send ADVANCE
- [ ] The client-side leaderboard step count is removed from the shared admin controls
- [ ] CONTEXT.md exists at the repo root and defines the Move plan (what one Advance or Previous press does, decided once in the Live session module)
- [ ] Backend, frontend and shared-types typecheck, lint and test green
