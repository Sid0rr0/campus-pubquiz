# Frontend audit log — 2026-11-03

Third frontend pass (`/ponytail-audit frontend, continue with`) at commit `9a14f25a`. Read-only: no code changed. No test suites, e2e runs or browser checks; every finding is traced in the code.

**Assumed load:** one backend instance, a few concurrent games, 10–40 phone teams and 1–2 staff consoles each; phones on mobile data that lock and wake often.

Started from the 2026-11-01 frontend log's "Not checked" list, plus the frontend side of the 21 commits since `42c9a89c`.

## Checked

| Area | Files read | What was checked | Result |
| --- | --- | --- | --- |
| Big-screen media | `display/question-display.tsx`, `use-media-pause.ts`, `components/closest-guess-reveal-screen.tsx`, `display-screen-view.tsx`, `control/replay-media-button.tsx`, `media-pause-button.tsx`, `shared/types/src/game-state.ts` (media actions) | fullscreen without remount, pause/mute on remount, replay per media kind, reveal notes | **YouTube replay with autoplay off** (finding 1). Rest OK |
| Player count card | `play/player-count-card.tsx`, `late-player-count-prompt.tsx`, `play/page.tsx` (bottom slot) | portal slot, lobby hand-over, failed send | OK |
| Second-pass fixes | commits `6de4728e`, `0a862ab7`, `536fcb16`, `aa1876bc`, `d5734232`, `928e852b` and their tests | each fix does what its finding asked, nothing dropped in the refactor | OK; tests fail on the old code |
| Accessibility | `play/sort-answer.tsx`, `match-answer.tsx`, `use-reorderable-draft.ts`, `play/settings-modal.tsx`, dialog imports | keyboard reorder, labels, dialogs | **Dead move button beside a pin** (2). Dialogs are Radix (focus trap, title); drag has a keyboard sensor; buttons are named |
| e2e suite | file list, `media.spec.ts` touch points | coverage of journeys, skipped tests | 20 journeys incl. reconnect, backend restart, media; no `.only`/`.skip`/`fixme` anywhere |

## Findings

1. "Play again" does not start a YouTube video when Autoplay media is off — should fix
2. A sort item next to a pinned end item keeps a move button that does nothing — nice to have

## Fixed (2026-11-03)

Both landed on `main`, each with a test. The e2e suite passed (30/30) on `dacc2c5d` in the later repo audit (`audit-log-2.md`).

| # | Status | Commit |
| --- | --- | --- |
| 1 | Fixed: the reloaded YouTube embed starts on Play again even with Autoplay media off | `1c1e8152` |
| 2 | Fixed: a sort move button that only runs into a pinned end item is disabled | `dacc2c5d` |

## Not checked

- The big-screen layouts on a real screen, and CSS in general
- Running the e2e suite; test quality beyond the tests of the second-pass fixes
- Screen-reader output of the drag lists (dnd-kit's default announcements)
- Still open from the repo logs: the real `req.ip` on Azure
