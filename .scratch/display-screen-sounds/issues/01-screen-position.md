# 01: The display view carries a screen position

**What to build:** The server sends `/display` a **screen position** on the display view (`screenPosition`). It is a number that orders the quiz's On-air screens: it grows on every forward move through the quiz and falls on Previous. Only the server orders the quiz. A pure shared-types function next to the On-air screen derives it from the session's progress, and the screen projection puts it on the display view only, not on the shared snapshot. Nothing on `/display` reads it yet. Ticket 02 switches the sounds over to it. See the spec's Implementation Decisions (Screen position).

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The display view carries `screenPosition`, declared once in the display room's view type. The admin and players views don't carry it.
- [ ] It strictly grows on every `START_QUIZ`, `ADVANCE` or `END_QUIZ` that changes the On-air screen underneath any overlay. That covers lobby/rules/round overview → round intro → each question → locking → break intro → break review → break round intro → reveal intro → each reveal → the next block's round intro → ended.
- [ ] It strictly falls on every `PREVIOUS` that changes that screen, including Previous back onto a round intro whose questions are already open, and browsing back through the break review.
- [ ] It stays the same for leaderboard and join overlay toggles, leaderboard rank reveals, showdown steps, closest-guess reveal steps, media fullscreen/pause/replay, and answer or roster updates.
- [ ] A shared-types test walks a seeded multi-block quiz (including a block that spans rounds, a break and a closest-guess reveal) with the game-state transition fixtures, and asserts all three invariants above. Use the forward-transition and backward-transition tests as prior art.
- [ ] A display page or projection test shows that the `roomView` fixture yields a `screenPosition` that grows across two forward views.
- [ ] `GLOSSARY.md` gains **Screen position**, with how it differs from the screen key. `DOCUMENTATION.md`'s display view table gains the `screenPosition` row.
- [ ] `pnpm typecheck` and the shared-types, backend and frontend tests pass.
