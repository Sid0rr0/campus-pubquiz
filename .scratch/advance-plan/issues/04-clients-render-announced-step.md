# 04: /control and /remote render the announced step and send only ADVANCE/PREVIOUS

**What to build:** The quiz master's Advance slot — on /control's desktop sidebar and mobile bar, and on /remote — takes its label and enabled state from the step the admin view announces, and always sends ADVANCE. The → key does exactly what the button does. Previous stays visible but greyed out, and ← does nothing, while the server reports it as covered by the leaderboard; it is hidden when unavailable. The Leaderboard toggle button and ↑/↓ keep sending the toggle directly. The browser stops computing leaderboard reveal steps. Labels for the plain advance case ("Begin Quiz", "Continue", "Start Round", "Advance") stay client-side UI copy chosen by status.

Parent spec: `.scratch/advance-plan/spec.md`

**Blocked by:** 03 (The server resolves Advance and Previous under the leaderboard; the admin view announces the step)

**Status:** ready-for-agent

- [ ] The Advance slot shows "Show Next Team", "Hide Leaderboard", the status-based advance label, or nothing, purely from the announced step
- [ ] Pressing the Advance slot or → always sends ADVANCE; no Advance-slot path sends REVEAL_NEXT_TEAM or TOGGLE_LEADERBOARD
- [ ] Previous renders greyed out while covered by the leaderboard and hidden when unavailable; ← sends PREVIOUS only when available
- [ ] /control and /remote behave identically for the Advance and Previous slots
- [ ] No client code derives "has unrevealed teams" or a leaderboard reveal step count
- [ ] Component tests with admin-view fixtures cover each announced step for the navigation buttons, the keyboard shortcuts and the /remote page; tests that expected REVEAL_NEXT_TEAM / TOGGLE_LEADERBOARD from the Advance slot now expect ADVANCE
- [ ] Manual check on the running app: walk a quiz through a leaderboard reveal, a kahoot between-questions board and a break on /control and /remote
