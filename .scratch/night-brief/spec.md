# Spec: A Night brief for writing next week's quiz

Status: ready-for-agent

Blocked by: —

## Problem Statement

Each week the quiz master writes the next quiz, often with an AI chat's help. Everything that should shape it is already on the stats page for last week's session: which questions were too hard or too easy, which wrong answers teams gave, how each round and each author's round was rated, and what topics teams asked for. But it's spread over tables, tiles, hovers and the Scoresheet. Getting it into an AI chat means copying by hand, and the stats page shows team names, which shouldn't go to an outside service.

## Solution

A **Night brief** (see `GLOSSARY.md`): one ended session written up as a single Markdown text for whoever writes the next quiz. On `/stats/:id` the quiz master presses **Copy**, pastes the text into their AI chat and adds their own prompt. **Download** saves the same text as a `.md` file. The app makes no AI calls and adds no preamble: the brief is data only.

The brief contains:

- **The session:** name, date, team count, player totals, and the score spread (top, median and bottom share of max points).
- **Standings with no team names:** each placing ("1st", "Joint 2nd", "left") with points, share of max points and player count.
- **Highlights:** the hardest and easiest question.
- **Each round:** number, title, category, author, round note, whether it's a kahoot round, its star rating (average and count) and its correct rate.
- **Each question:**
  - number, type, prompt, the correct answer, points and question notes
  - "(image)", "(video)" or similar when it has media, never the URL
  - answered, correct and partial counts and the correct rate
  - its wrong answers, by type:
    - `multiple_choice`: every option with how many teams picked it, the right one marked
    - `free_text` and `number`: the top 3 wrong answers with counts
    - `closest_guess`: the spread of guesses (lowest, median, highest)
    - `sort` and `match`: none
  - ungraded answers listed separately
  - "not played" when the question was never shown
- **Feedback:** topic suggestions with counts and the comments as written, or one line saying feedback was off.

## User Stories

1. As a quiz master, I want to copy last week's session as one text, so that I can paste it into an AI chat in one step.
2. As a quiz master, I want to download the same text as a Markdown file, so that I can attach it to a chat or keep it.
3. As a quiz master, I want the downloaded file named after the session and its date, so that I can tell weeks apart.
4. As a quiz master, I want a "Copied" confirmation, so that I know the clipboard holds the brief.
5. As a quiz master, I want the brief to carry data only, no built-in instructions, so that I can write my own prompt each week.
6. As a quiz master, I want every question with its answer and points, so that the AI knows what was asked and avoids repeating it.
7. As a quiz master, I want each question's notes in the brief, so that the AI sees the context I wrote about it.
8. As a quiz master, I want each question's correct rate and counts, so that the AI can match next week's difficulty.
9. As a quiz master, I want the most common wrong answers to typed and number questions, so that the AI can spot misleading wording and common misconceptions.
10. As a quiz master, I want every multiple choice option with its pick count, so that the AI can see which wrong option fooled teams.
11. As a quiz master, I want the spread of guesses on closest guess questions, so that the AI can judge whether the range felt fair.
12. As a quiz master, I want sort and match questions summarised by their counts only, so that long answer chains don't bury the useful data.
13. As a quiz master, I want ungraded answers listed apart from wrong ones, so that the AI doesn't treat a likely synonym as a miss.
14. As a quiz master, I want questions that were never played marked "not played", so that the AI doesn't read the missing answers as "nobody knew".
15. As a quiz master, I want a media flag on questions with images or video, so that the AI knows a question leaned on a picture or clip.
16. As a quiz master, I want each round's title, category and note, so that the AI sees the shape of the quiz.
17. As a quiz master, I want each round's author, so that I can see whose rounds rated well and played at the right difficulty.
18. As a quiz master, I want each round's star rating and correct rate, so that the AI knows which rounds teams enjoyed.
19. As a quiz master, I want kahoot rounds marked, so that speed-scaled points don't look strange.
20. As a quiz master, I want the standings as placings, points and share of max points, so that the AI sees how close the night was.
21. As a quiz master, I want the score spread as one line, so that the AI can tell at a glance whether the night was too hard or too easy.
22. As a quiz master, I want the hardest and easiest question named, so that the extremes stand out.
23. As a quiz master, I want the topic suggestions with counts, so that the AI can lean into what teams asked for.
24. As a quiz master, I want the teams' comments as written, so that the AI hears their complaints and praise.
25. As a quiz master, I want the brief to say when feedback was off, so that the AI doesn't read missing feedback as "no complaints".
26. As a quiz master, I want player totals and team count, so that the AI knows the size of the crowd.
27. As a team, I want our team name, code and id kept out of the brief, so that our results aren't sent to an outside AI service under our name.
28. As a moderator, I want the same brief access as admins, so that whoever writes the next quiz can export it.
29. As a quiz master, I want every figure in the brief to match the stats page, so that I never have to wonder which is right.
30. As a quiz master, I want a Night brief only for ended sessions, so that it never reflects a night still in progress.
31. As a quiz master, I want bonus points counted in the standings totals but not itemised, so that the brief stays about questions.

## Implementation Decisions

- **Endpoint:** `GET /stats/sessions/:id/brief`, with the same guards as the other stats endpoints (admin and moderator). It returns the brief as `text/markdown`. A running, unknown or non-ended session gets the same 404 as the session detail, and a non-numeric id gets a 400.
- **A pure calc builds the brief:** the stats service reads the session's rows, and one pure function turns them into the Markdown text. It sits beside the session detail calc and reuses what that calc already uses, so the two can't disagree:
  - the **Question outcome** module, with the same team count (every team that took part, departed teams included)
  - the **Session result** and Standings ranking (placing, ties, "left", totals including bonus awards)
  - the correct-rate rules (credit by verdict; `closest_guess` has no correct rate and is never the hardest or easiest question)
  - the round rating aggregation
  - topic grouping (`groupTopics`)
  - the `collectFeedback` default (stored without the setting reads as on)
  - player-count totals
- **Answers are worded by `formatAnswer`**, for the key and for teams' answers alike. Question notes go through `questionNotesOf` (the `{…}` settings group dropped, trimmed); a blank note is left out.
- **Wrong answers per type:**
  - `free_text` and `number`: incorrect answers are grouped the way topics are (trim, collapse inner whitespace, ignore case), and the top 3 are shown by count, ties alphabetical, each in its most common spelling. Partial answers are not wrong answers.
  - `multiple_choice`: every option in its stored order with its pick count, the correct one marked.
  - `closest_guess`: the lowest, median and highest guess beside the key.
  - `sort` and `match`: none.
- **Ungraded answers** (left after a force-end or a live answer-key fix) are grouped the same way and listed on their own line, never among the wrong answers.
- **"Not played":** a question with no stored answers that the session never reached. Being reached is derived from where the session stood when it ended (every question up to the last one put in front of teams), not from having answers, so a played question that nobody answered still reads "0 answered". The implementer checks what the stored session row keeps for this; if it can't tell, the fallback is "not played" for every question after the last one with an answer, and the spec gets a comment saying so.
- **No team identity:** no team name, team code or team id is selected for the brief, and standings rows carry only placing, points, share, player count and "left". Comments and wrong answers are passed through as written; the moderator reviews the text before pasting it.
- **Media:** a flag naming the media kind for `media_url` and for `answer_media_url`, never the URL.
- **Round author** is the round's free-text author as stored; a round without one shows no author line. Authors are not grouped across sessions here.
- **Layout:** Markdown headings for session, standings, feedback and each round, with one compact block per question. Exact wording is the implementer's, but it must stay readable when pasted raw (no HTML, no wide tables for the per-question data).
- **Frontend:** the `/stats/:id` header gets a "Night brief" control with **Copy** (fetches the text, writes it to the clipboard, shows a "Copied" toast, and an error toast on failure) and **Download** (saves `night-brief-<session-name-slug>-<YYYY-MM-DD>.md`). The `/stats` list doesn't get it.
- **Docs:** a "Night brief" subsection under Session Stats in `DOCUMENTATION.md`. The glossary term already exists. `/control` doesn't change, so the `/guide` page doesn't either.

## Testing Decisions

- Test external behaviour: the brief text for given stored rows, the endpoint's response and guards, and what the buttons do. Don't test internal helpers on their own.
- **The pure calc is the main seam.** Unit tests feed it row fixtures and assert on the produced text, following the session detail calc's tests. They cover:
  - wrong answers for each type (the top 3, ties, grouping across spellings)
  - multiple choice counts, the closest guess spread, and no wrong answers for sort and match
  - ungraded answers listed apart
  - "not played" vs. "0 answered"
  - feedback off
  - kahoot round marked, author present and absent
  - departed teams counted and shown as "left"
  - no team name, code or id anywhere in the output (fixtures use distinctive names, and the test asserts they're absent)
  - one case comparing figures with `computeSessionDetail`'s output for the same rows
- **One thin Postgres test** through the stats service, following the existing stats service integration spec: an ended session's brief contains its questions and figures; a running or unknown session gets a 404.
- **The controller spec** pins the guards (admin and moderator allowed) and the non-numeric-id 400.
- **One frontend test** on the session detail panel, following its existing test: Copy writes the fetched text to the clipboard and shows the toast; Download saves a file with the expected name.

## Out of Scope

- Any AI integration or API call from the app.
- A built-in or remembered prompt or preamble.
- A brief across many sessions (a date range or a league). `/stats/feedback` covers trends.
- Author trends across sessions, including grouping authors' spellings. That would be its own spec (`author-trends`).
- Itemised bonus awards.
- Redacting team names from comments or answers.
- The brief on the team page or for teams.

## Further Notes

- The brief is computed per request from the stored rows and never cached, like the rest of the stats page.
- In a normally run night, ungraded answers can't exist, because leaving break review is refused while any are ungraded. They only appear after `END_QUIZ` force-ends a session mid-block, or after a live answer-key fix sends an answer back to ungraded.
