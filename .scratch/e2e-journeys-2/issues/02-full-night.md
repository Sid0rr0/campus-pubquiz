# 02: The full-night journey

**What to build:** `e2e/fixtures/full-night.csv` and a journey that plays it end to end: the manual run-through, automated.

The CSV: two blocks, every question type, one kahoot round, round categories and authors, a `round_note` shown on screen and one that isn't, a bonus category, a fun fact, and an image, an audio and a video question.

The journey visits every status in the `DOCUMENTATION.md` table on the big screen, two phones and `/control`, snapshotting each: lobby, rules, round overview, round intros with notes, questions, locking, break intro with the fun fact, break review walked with `PREVIOUS` (including `break_round_intro` and back across into the previous block's reveal), grading, reveal intro, reveal, the leaderboard slot by slot, the join overlay shown and hidden, and ended with its podium.

Parent spec: `.scratch/e2e-journeys-2/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Every status cell for the big screen and phone is visited.
- [x] `PREVIOUS` through break review, leaderboard and join overlay moves are recorded.
- [x] Final standings are asserted by hand.
- [x] Passes `--repeat-each=5`.

Notes: the break screen's first fun fact only appears 60 s after it is put on air (a client timer, `FUN_FACT_START_DELAY_MS`), so the journey waits it out in real time while it grades; the whole night takes about 2.3 minutes. The video clip stand-in is not decodable, so the journey asserts only the video question's prompt.
