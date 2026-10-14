# Sound licences

Every file here must be CC0 (public domain) or equivalent, with its source
recorded in the table below before it is committed.

| File                | Used for                 | Source / licence                       |
| ------------------- | ------------------------ | -------------------------------------- |
| lock-countdown.mp3  | Block lock countdown     | Pre-existing                           |
| sting.mp3           | Round intro sting        | TODO: add CC0 file and source URL      |
| chime.mp3           | Lobby team joined        | TODO: add CC0 file and source URL      |
| drumroll.mp3        | Leaderboard top three    | TODO: add CC0 file and source URL      |
| reveal.mp3          | Answer reveal            | TODO: add CC0 file and source URL      |
| slam.mp3            | Showdown guess           | TODO: add CC0 file and source URL      |
| burst.mp3           | Showdown winner          | TODO: add CC0 file and source URL      |
| fanfare.mp3         | Quiz ended               | TODO: add CC0 file and source URL      |

The names are the registry in `apps/frontend/app/lib/display-sounds.ts`. A
missing file fails silently (the play call is swallowed), so the game is
unaffected until the file is added.
