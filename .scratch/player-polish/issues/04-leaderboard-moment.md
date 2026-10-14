# 04: Leaderboard — top-three drama and the team's own row

**What to build:** Spec: `.scratch/player-polish/spec.md`, "Leaderboard". On the big screen ranks 3, 2 and 1 reveal slower with a drumroll, and rank 1 gets a spotlight; rank reveal stays one per Advance. On the phone's leaderboard screen the team's own row is highlighted with its placing ("You're 4th", "Joint 2nd" from the competition rank), and the phone vibrates when the team moved up — only when the board shows trends, never on the first board.

**Blocked by:** 01

**Status:** done

- [x] Phone placing text for a plain rank and a tie (Vitest, test first)
- [x] Phone vibrates on an up-move with trends shown; not without trends; not on reconnect
- [x] Display: top-three entrance and drumroll; Advance during it cuts straight to the next rank

## Comments

- The players view gained a players-only `phoneLeaderboard` (`{ board, revealCount }`), because the phone had no trends and must not show its placing before the big screen reveals that rank.
- The shared placing text is `apps/frontend/app/lib/placing-text.ts` (`placingText(entry, wording?)`, `ordinal`); ticket 09 passes its own wording, e.g. `(place) => \`You finished ${place} of 12\``, and ties stay "Joint 2nd".
- Known gap: on the very first kahoot board (all prior standings tied) the server marks every team `up`, so every phone buzzes once when its row is revealed. Left as the server decides trends; a server-side "first board" flag would fix it.
- The drumroll has no stop, so a quick Advance through ranks 3, 2, 1 overlaps drumrolls; `displaySounds` has no stop yet (ticket 02 owns that file).
