# 01: Previous on the rules goes back to the lobby

**What to build:** A quiz master who pressed Start quiz too early can press Previous (button or keyboard shortcut) on the rules to take the session back to the lobby. The big screen shows the lobby again: QR code, join code and roster. Phones show "Waiting for the quiz to start…". Everything that only works in the lobby unlocks again: session settings, quiz import or overwrite, and closing the session. Start quiz is the next press again and moves forward exactly as it did the first time. Only the rules can go back to the lobby. From `round_overview`, Previous still goes to the rules first, and from the first round intro onward (once the block has started) Previous never reaches the lobby. There's no confirm dialog. See `.scratch/join-overlay/spec.md`.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The shared transition function accepts `PREVIOUS` on `rules` and returns `lobby` with the round, question and reveal indexes reset. Covered in the existing backward-transition tests.
- [ ] `PREVIOUS` on `lobby` is still illegal.
- [ ] Backend gateway test against a real database: Previous on the rules leaves the display and players views on the lobby screens, a lobby-only settings change is accepted again, and Start quiz then moves to the rules.
- [ ] Backend gateway test: Previous from `round_overview` lands on the rules, and Previous from the first round intro does not reach the lobby.
- [ ] The Move plan's next press in the lobby is Start quiz again.
- [ ] `/control`: the Previous button and its keyboard shortcut are enabled on the rules (frontend test in the style of the existing Previous button test).
- [ ] `DOCUMENTATION.md`: the `PREVIOUS` row covers rules → lobby, and the lobby row says it can also be reached by `PREVIOUS` from `rules`.
- [ ] The `/guide` page explains that Previous on the rules goes back to the lobby.
