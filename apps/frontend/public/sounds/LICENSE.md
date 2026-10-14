# Sound licences

Every file here must be CC0 (public domain) or equivalent, with its source
recorded in the table below before it is committed.

| File               | Used for                     | Source / licence                                                                                                                                                                                              |
| ------------------ | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| lock-countdown.mp3 | Block lock countdown         | "household-clock-ticking-60-second-countdown" from Pixabay, Pixabay Content License (free to use, credit appreciated) — https://pixabay.com/sound-effects/household-clock-ticking-60-second-countdown-118231/ |
| sting.mp3          | Round intro sting            | TODO: add CC0 file and source URL                                                                                                                                                                             |
| chime.mp3          | Lobby team joined            | "dingDing" by Glitched7777, CC0 — https://freesound.org/people/Glitched7777/sounds/723291/                                                                                                                    |
| drumroll.mp3       | Leaderboard top three        | TODO: add CC0 file and source URL                                                                                                                                                                             |
| reveal.mp3         | Answer reveal                | TODO: add CC0 file and source URL                                                                                                                                                                             |
| slam.mp3           | Showdown guess               | TODO: add CC0 file and source URL                                                                                                                                                                             |
| burst.mp3          | Showdown winner              | TODO: add CC0 file and source URL                                                                                                                                                                             |
| fanfare.mp3        | Quiz ended, final winner     | "Success Fanfare Trumpets" by FunWithSound, CC0 — https://freesound.org/people/FunWithSound/sounds/456966/                                                                                                    |
| time-up.mp3        | Block locks (countdown over) | "Orchestral Crush" by tosha73, **CC BY 4.0 (attribution required)** — https://freesound.org/people/tosha73/sounds/874474/                                                                                     |

The names are the registry in `apps/frontend/app/lib/display-sounds.ts`. A
missing file fails silently (the play call is swallowed), so the game is
unaffected until the file is added.
