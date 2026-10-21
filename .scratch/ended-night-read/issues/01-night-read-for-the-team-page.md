# 01: Night read on the Ended-sessions read, used by the Team page

**What to build:** the Ended-sessions read gains a night read: given an ended session and optionally one team, it returns the night's questions in play order and the stored answers, both worded the way the screens show them (see the spec's Implementation Decisions for the shape). The Team page's night is the first caller: it keeps its team code lookup, header and took-part check, then reads the night narrowed to its team and pairs each question with the team's own answer. A team sees exactly what it sees today: every question in order with round title, round number and question number, its own answer, verdict and points, and the right answer.

The read carries every field the spec lists, including the ones only the stats session detail will use (team name, graded-at, response time), so ticket 02 never has to change it.

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The night read returns questions in round order then question order, each with round id and title, round number and question number (both from 1, question number restarting per round), order index, prompt, type, answer kind, points as a number and the worded Answer key
- [ ] It returns answers with question id, team id, team name, verdict, points awarded as a number, graded-at, response time in ms (null when missing) and the worded answer
- [ ] Each question's payload is parsed once and shared by its key and every answer to it
- [ ] With a team id, only that team's answer rows are queried (narrowed in SQL, not filtered after loading)
- [ ] The read doesn't check session status or participation, and its doc comment says callers check `endedSession` (and took-part where it applies) first
- [ ] The choice of question source (the quiz's current rows) is made only inside the night read
- [ ] The Ended-sessions read's real-Postgres spec covers: play order across rounds whose order index differs from their id order; numbering from 1 restarting per round; a choice question's key and answers worded with option text; all teams' answers with team names when unnarrowed, only one team's when narrowed; an unanswered question still returned with no answer; a kicked team's answers returned when narrowed to it; numeric fields as numbers and a missing response time as null
- [ ] The Team page's night uses the read; its own question/answer SQL, numbering loop and per-row payload parse are gone
- [ ] The Team page controller spec passes with no assertion changed
- [ ] `TeamNightDetail` keeps its shape; no schema, protocol or frontend change
