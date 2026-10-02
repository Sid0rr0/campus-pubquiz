# 02: Submit answer is one module event

**What to build:** A team's answer goes into the Live session module as one event, together with the id of the socket that sent it. Inside, the module:

- checks the question is open for answering
- checks the socket owns the team's seat
- measures the kahoot response time from the same phase start that kahoot speed scoring uses
- submits the answer
- runs the existing answer-change refresh
- returns "answer received" as a reply to the sender

The submit handler becomes a one-line adapter. Teams see exactly what they see today.

Parent spec: `.scratch/live-session-events/spec.md`

**Blocked by:** 01.

**Status:** ready-for-agent

- [ ] A late answer is refused with "Answers are locked for this question".
- [ ] An answer for another team's seat is refused with "You may only submit answers for your own team".
- [ ] "Answer received", with graded points for auto-graded types, reaches the sender before the room-wide update.
- [ ] In a kahoot round, a faster answer still scores more than a slower one.
- [ ] The leaderboard, answered teams and ungraded markers refresh as they do today.
