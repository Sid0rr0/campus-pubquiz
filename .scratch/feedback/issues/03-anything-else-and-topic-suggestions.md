# 03: "Anything else" and topic suggestions

**What to build:** The final feedback form gains an "Anything else?" text box (up to 1000 characters) and topic suggestions: one line per topic (up to 60 characters each), with "+ Add another" adding a line, up to 10. A Send button sends the comment and topics together and shows "Sent ✓" once acknowledged; after an edit it can be pressed again, and the new text replaces the old. Empty and whitespace-only topic lines are dropped. The form checks the limits before Send and says what's wrong.

Sending feedback is a players-only socket event with a Zod-validated `{ comment, topics }` and an ack, accepted only while the final form is open. It saves one session feedback row per (session, team), replacing the whole row; topics are stored as a JSON string array and parsed with Zod on read. It broadcasts nothing and doesn't go through the session write. The join-accepted payload carries the team's comment and topics, so a reconnecting phone shows them again.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: at `ended` with the final form open, Send is acknowledged as ok, and a reconnect's join payload carries the comment and topics.
- [ ] Sending again replaces the earlier comment and topics; empty and whitespace-only topics are dropped and the rest are trimmed.
- [ ] Send before `ended`, or while a showdown is still being played, is refused with a reason.
- [ ] More than 10 topics, a topic over 60 characters, or a comment over 1000 characters is refused by validation.
- [ ] Another team's join payload never carries this team's text.
- [ ] Phone: "+ Add another" adds a line and stops at 10; the form shows a limit message before Send; an ok ack shows "Sent ✓"; editing clears "Sent ✓" until Send is pressed again.
- [ ] `DOCUMENTATION.md` describes the new event and the join payload addition.
