# 03: Kick and the team's recovery code

**What to build:** Two journeys on the escape hatches for a team's identity.

**4a: Kick, then rejoin with the code.**

1. A team joins and answers a question.
2. The quiz master kicks it from `/control`'s Teams panel and confirms.
3. The team drops off the roster on `/control` and on the big screen.
4. The phone lands on the join screen with "You were removed from this team by the quiz master", and its name and team-code fields are empty.
5. Rejoining under the same name without the code is refused. With the recovery code (read off `/control`'s team code dialog), the join goes through.

**4b: A teammate's second phone.**

1. Team A joins on phone 1.
2. Phone 2, a fresh context with empty storage, joins under Team A's name with the recovery code while phone 1 is still connected.
3. Phone 2 shows Team A's existing answers and the current question.

Parent spec: `.scratch/e2e-tests/spec.md`

**Blocked by:** 01

**Status:** done

- [x] Before writing the steps, check in the code whether the team's earlier answers come back after a kick and rejoin, and whether phone 1 stays linked once phone 2 joins (handover or both linked). Assert what the code intends, and note it in this ticket under `## Comments`.
- [x] 4a passes.
- [x] 4b passes.
- [x] Both pass `--repeat-each=5`.

## Comments

What the code intends (checked before writing the steps):

- **Answers after kick and rejoin: they come back.** A kick only deletes the `game_session_teams` row (`TeamService.removeFromRoster`); the `Answer` rows stay. A rejoin with the recovery code adds the roster row again, and `joinReply` loads the answers by team and session (`AnswerService.listForTeam`). 4a asserts the earlier wrong answer is shown again as submitted.
- **Second phone while phone 1 is connected: refused, no handover.** `TeamRosterChanges.join` refuses a join when a live socket holds the team's seat, unless the request names that socket in `previousSocketId`. Only the same device knows its old socket id, so a fresh phone is always refused ("already connected on another device — ask the quiz master to remove it, then try again") and phone 1 stays linked and can still answer. So the ticket's "while phone 1 is still connected" step is asserted as a refusal. 4b then closes phone 1's browser, waits for `/control` to show the team as disconnected, and retries on phone 2, which gets the seat, the current question and the answers already given.
- The team code dialog sits in `/control`'s Teams table, which only shows once the quiz has started and drops a kicked team. 4a reads the code before the kick.
- A kicked phone lands on `/play` (the URL keeps the session's `?code=`), so the quiz may already be preselected; the test picks it only when it isn't.
