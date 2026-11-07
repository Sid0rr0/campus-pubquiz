# Spec overview

Specs that still have open tickets, one row per spec under `.scratch/`. A spec is unblocked once everything in its "Blocked by" column appears in [`done.md`](done.md). Each spec has a `spec.md` and an `issues/` folder holding its tickets.

## Not implemented

| Spec | Title | Tickets | Blocked by |
| ---- | ----- | ------- | ---------- |
| quickfire-mode | [Quickfire is a quiz mode, not a round setting](quickfire-mode/spec.md) | 5 | none |
| coin-ledger | [One Coin ledger for a team's coins and the coin rules](coin-ledger/spec.md) | 3 | none |
| doubled-rounds | [One Doubled rounds module for the Joker and the Extra joker](doubled-rounds/spec.md) | 4 | none |
| quiz-mode-module | [One shared Quiz mode module: what a quickfire quiz turns off](quiz-mode-module/spec.md) | 4 | power-up-offer (ticket 04 only) |
| play-page-wiring | [The /play page as plain wiring](play-page-wiring/spec.md) | 2 | power-up-offer, coin-ledger, quiz-mode-module (ticket 04), doubled-rounds (ticket 04) |

## Won't do

Not a whole spec: `role-socket-hooks` ticket 05 (control panel context) is marked `wontfix`, because `props-refactor` 03's single Control panel prop covers it.
