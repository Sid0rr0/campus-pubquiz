# 03: An editor save is checked and applied inside the live sessions' writes

**What to build:** A quiz master saving a live quiz just as the quiz moves on gets a clean result. Either the save lands with every live session still behind the frontier it was checked against, or it's refused with the same 409 and issues as today. A question can never be deleted or moved from under the big screen as it opens. Today the save reads the frontier, checks the draft, saves and asks the gateway to reload each session, all outside the sessions' writes, so an Advance in between isn't seen.

A new Live edit module in the game area has one operation: save this quiz's title and rounds by quiz id. With no live session on the quiz it's a plain save. Otherwise, using ticket 02's hold, it holds every live session on the quiz while it:

1. decides which sessions are live, inside the hold;
2. reads and merges their frontiers and checks the incoming rounds;
3. saves;
4. reloads each session and regrades opened questions whose answer or points changed, ending with the standings read, then stores it.

Outcomes are delivered after the hold is released. The Live session module's quiz edit event splits into a step that takes and returns a session plus its outcome, and its frontier reader takes a session. The quiz controller only translates HTTP to and from the module's errors (409, 422 and 404), and no longer calls the gateway or the Live session module.

Docs in the same commit: `GLOSSARY.md`'s **Live-edit frontier** entry gains "checked and applied while the live sessions are held, so the game can't move past it during a save". `DOCUMENTATION.md`'s live-edit section says the same. The `/guide` page gains one line: a save made just as the quiz moves on may be refused, and the quiz master reloads.

Parent spec: `.scratch/live-edit-save/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a save that deletes the next unopened question, overlapped with an Advance that opens it (the press held on its progress save), is refused with the existing issue, and the session's on-air question is unchanged.
- [ ] The reverse order: the save lands first, and the Advance opens the question that now follows.
- [ ] A save the frontier allows, made during a press, lands, and the session carries on from the same opened question.
- [ ] An answer-key fix on an opened question regrades consistently with a grade landing at the same moment.
- [ ] Two sessions live on one quiz: the save is checked against both, and a press held on one holds the save.
- [ ] A session on another quiz isn't held up by the save.
- [ ] The quiz controller spec covers only HTTP mapping, with no mocked game state. The live-structural-edit, quiz-edited, live-edit-regrade and opened-questions specs pass, saving through the module where they used the controller or gateway path.
- [ ] GLOSSARY, DOCUMENTATION and the `/guide` page are updated in the same commit.
