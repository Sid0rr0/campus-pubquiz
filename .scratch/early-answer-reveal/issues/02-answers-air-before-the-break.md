# 02: Answers air between the lock and the break

**What to build:** With **Early answer reveal** on, locking a block goes straight into the early answer reveal: `answers_intro` (an "ANSWERS · ROUND N" round title card) → `answers` (one question with its correct answer), crossing round boundaries via `answers_intro`, and after the block's last question → `break_intro` (see the [spec](../spec.md) and ADR 0006). With the setting off, nothing changes.

- **Statuses:** new `answers_intro` and `answers`, in the **revealing** status group but not in **graded**, **answering** or **break**. The groups don't depend on any setting.
- **Big screen:** `answers` draws what `reveal` draws (correct answer, answer media, reveal clip, question notes when set to show, power-up use counts, the full closest-guess stepped reveal), minus anything derived from grading (the correct-rate figures).
- **Phones:** on `answers`, the block browser in a new mode that shows the team's own answer beside the correct answer, with no verdict colours or points. "Follow the screen" tracks the question on air. `answers_intro` shows "Look at the screen" with the round title and the joker badge, like `reveal_intro`.
- **Presenter:** `/remote`'s "next" line, the round note on `answers_intro` and the question notes on `answers`, as on the reveal.
- **Settle:** timers and the stepped reveal behave on `answers_intro`/`answers` as on `reveal_intro`/`reveal`. The break timer starts at `break_intro`.
- Leaving the break still goes through the old reveal in this ticket; ticket 03 changes that.
- **Docs:** the status table and display/players view fields in `DOCUMENTATION.md`. The `/guide` text goes in ticket 07.

**Blocked by:** 01

**Status:** done

- [ ] Move plan tests: with the setting on, `locking` → `answers_intro` → `answers` … → `break_intro` across rounds; with it off, unchanged
- [ ] Status group tests place `answers_intro`/`answers` in revealing only
- [ ] Screen projection tests: the display on `answers` has the answer, notes and power-up counts but no correct-rate figures; a closest_guess question walks its steps
- [ ] Screen projection tests: the phone on `answers` shows its own answer and the correct answer with no verdict or points
- [ ] `/remote` describes the next press on the new statuses
