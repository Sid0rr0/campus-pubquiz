# 05: Lock — draining bar, Locked stamp, Saved ✓ on the phone

**What to build:** Spec: `.scratch/player-polish/spec.md`, "Lock". During `locking` the phone shows a thin bar draining to the lock deadline the display already uses. When the block locks the phone vibrates and stamps "Locked" (through the live-change helper). Every accepted submit shows a small "Saved ✓" — a reply to the team's own action, so not subject to the live-change rule.

**Blocked by:** 01

**Status:** done

- [x] Bar reflects the remaining time to the lock deadline (Vitest, test first)
- [x] Locked stamp and vibration on a live lock; not on reconnect into a locked block
- [x] "Saved ✓" shows after an accepted submit, not after a refused one

## Comments
