# 03: The Move plan plans every action, lobby start included

**What to build:** Every admin action goes through the Move plan, not only ADVANCE and PREVIOUS. Other actions (START_QUIZ, TOGGLE_LEADERBOARD and the rest) become a plain transition or blocked step through the state machine, so the action handler never branches on the action outside the plan. The Move plan module also owns "the next press": START_QUIZ in the lobby when the leaderboard isn't up, ADVANCE everywhere else. The presenter preview asks the plan for it and drops its own lobby special case. Nothing changes on stage. /control's Start button and the lobby's Advance slot behave as today, and /remote still previews the rules screen from the lobby.

Parent spec: `.scratch/commit-a-move/spec.md`

**Blocked by:** 01 (Agreement walk pins today's preview against the real press)

**Status:** ready-for-agent

- [ ] Every admin action is planned by the Move plan; illegal actions come back as a blocked step and are refused with today's message
- [ ] The action handler has no branch on the action outside the plan
- [ ] "The next press" lives in the Move plan module; the presenter preview no longer special-cases the lobby
- [ ] The Advance slot and Previous state announcements are unchanged everywhere, including the lobby
- [ ] The action-availability walks, presenter context, state-transitions, admin-actions and socket authorization specs pass unchanged
- [ ] The 01 agreement walk's lobby step passes with no new exceptions
