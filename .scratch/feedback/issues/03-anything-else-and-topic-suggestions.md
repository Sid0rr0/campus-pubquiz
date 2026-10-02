# 03: "Anything else" and topic suggestions

**What to build:** The final feedback form gains an "Anything else?" text box (up to 1000 characters) and topic suggestions: one line per topic (up to 60 characters each), with "+ Add another" adding a line, up to 10. A Send button sends the comment and topics together and shows "Sent ✓" once acknowledged; after an edit it can be pressed again, and the new text replaces the old. Empty and whitespace-only topic lines are dropped. The form checks the limits before Send and says what's wrong.

Sending feedback is a players-only socket event with a Zod-validated `{ comment, topics }` and an ack, accepted only while the final form is open. It saves one session feedback row per (session, team), replacing the whole row; topics are stored as a JSON string array and parsed with Zod on read. It broadcasts nothing and doesn't go through the session write. The join-accepted payload carries the team's comment and topics, so a reconnecting phone shows them again.

Parent spec: `.scratch/feedback/spec.md`

**Blocked by:** 02

**Status:** done

- [x] Written first, failing against today's code: at `ended` with the final form open, Send is acknowledged as ok, and a reconnect's join payload carries the comment and topics.
- [x] Sending again replaces the earlier comment and topics; empty and whitespace-only topics are dropped and the rest are trimmed.
- [x] Send before `ended`, or while a showdown is still being played, is refused with a reason.
- [x] More than 10 topics, a topic over 60 characters, or a comment over 1000 characters is refused by validation.
- [x] Another team's join payload never carries this team's text.
- [x] Phone: "+ Add another" adds a line and stops at 10; the form shows a limit message before Send; an ok ack shows "Sent ✓"; editing clears "Sent ✓" until Send is pressed again.
- [x] `DOCUMENTATION.md` describes the new event and the join payload addition.

## Comments

Implemented in a single commit, `feat(backend): anything else and topic suggestions on the final form` (find it with `git log --grep "anything else and topic suggestions"`; the hash isn't known until the commit exists).

- Event: `SEND_FEEDBACK` (`game:send_feedback`), players-only, `{ comment, topics }`. `sendFeedbackPayloadSchema` trims topics and drops empty ones _before_ checking the limits (≤10 topics, ≤60 characters each, comment ≤1000), so a stray space can't push a team over. The limits are shared constants in `shared/types/src/socket-events.ts` (`MAX_FEEDBACK_*`), used by the phone's own checks too.
- Gate: `GameStateService.isFinalFormOpen`, which reads the same `getFeedbackField` as `RATE_ROUND`, so "final form open" has one definition. Refusal reason: "Feedback can't be sent right now". Handler: `send-feedback.handler.ts`; no broadcast, no session write.
- Storage: new `session_feedback` table (migration `Migration20261002130000_AddSessionFeedback`), unique on (session, team), upserted so a send replaces the whole row; `topics` is `jsonb` and parsed with Zod in `FeedbackService.getFeedbackForTeam`.
- Join: `JOIN_ACCEPTED` carries `feedback: { comment, topics }` (empty when nothing was sent).
- Phone: `FeedbackTextForm` under the star rows. Review found two bugs that were fixed before the commit: remounting the form on every join payload wiped a half-typed draft, and an edit made while a send was in flight was shown as "Sent ✓". The text form is now no longer keyed on the join epoch (only the star rows are); it holds a versioned draft, adopts a new saved text only when it has no unsent edits, and marks "Sent ✓" only for the version that was acknowledged.
- Specs: `send-feedback.spec.ts` (real database), `final-feedback-comment-topics.test.tsx`, additions to `use-player-game.test.ts`. Full suites, lint and build pass. One full frontend run reported a failing exit although all 953 tests passed; two reruns were clean and I couldn't reproduce it.
