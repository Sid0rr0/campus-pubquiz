# Live structural edits only after the opened part of the quiz

While a session is running, the quiz editor can add, delete and reorder questions and rounds, and change a round's break-after and kahoot setting, but only in the part of the quiz no live session has opened yet. Game progress stays positional (`roundIndex`/`questionIndex`). Questions open in order, so the opened questions are always the start of the quiz, and an edit that leaves that start untouched can't shift any saved position. The alternative was storing progress by question id, so that any reorder would be safe. We didn't, because it would rewrite the state machine and the session data for a case (reshuffling questions teams have already seen) nobody needs.

What stays frozen:

- **Opened questions keep their place for good.** A question counts as opened from the moment it first opens in any live session, even if Previous later steps back before it.
- **The current round keeps its place, break-after and kahoot setting** while it's on screen, even before any of its questions opens.
- **The current block is frozen once it starts locking.** Adding a question then would put the locking countdown on a question that's no longer the last one, or add an unanswerable question to a locked block.

The server checks all of this at save time against every live session. A save made after the game moved past an edited question is refused with a 409, and the quiz master reloads.
