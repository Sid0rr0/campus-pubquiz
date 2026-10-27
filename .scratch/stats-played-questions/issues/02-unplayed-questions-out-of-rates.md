# 02: Keep unplayed questions out of correct rates and highlights

**What to build:** On an ended session's stats page and in its Night brief, a question the session never played no longer counts as one nobody got right. It has no correct rate, so it is never the Hardest or Easiest question and never in the all-correct or none-correct list. A round's correct rate and points % cover only its played questions, so a round where nothing was played has no correct rate and can't be the Hardest round. The Night brief's Highlights therefore never name a question it marks "(not played)". Max points, team score shares and the difficulty label stay based on the whole quiz. A session that played every question shows the same figures as before.

**Blocked by:** 01 (Move the played-question rule into the session detail)

**Status:** ready-for-agent

- [ ] An unplayed question's correct rate is null; its answered and correct counts are unchanged
- [ ] An unplayed question is never the hardest or easiest question and is in neither the all-correct nor the none-correct list
- [ ] A round's correct rate averages only its played questions with a correct rate (null when there are none); its points % is measured against only its played questions' points (0 when that is 0)
- [ ] A round with nothing played is never the hardest round
- [ ] An opened question with no answers has a 0% correct rate and can still be the hardest question
- [ ] A question with stored answers counts as played even when missing from the opened list
- [ ] Max points and the difficulty average % and label are unchanged by unplayed questions
- [ ] Session detail calc spec gains fixture cases for each rule above, plus "every question opened = figures unchanged"
- [ ] Session brief calc spec gains a case: a session ended early whose Highlights never name a "(not played)" question, and whose round correct rate matches the detail's
- [ ] Stats service spec gains a case: a session row with stored opened ids gives an unopened question a null correct rate on the session detail
- [ ] `DOCUMENTATION.md` says unplayed questions are left out of the stats page's correct rates and highlights, if it describes them
