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

**Status:** ready-for-agent

- [ ] Before writing the steps, check in the code whether the team's earlier answers come back after a kick and rejoin, and whether phone 1 stays linked once phone 2 joins (handover or both linked). Assert what the code intends, and note it in this ticket under `## Comments`.
- [ ] 4a passes.
- [ ] 4b passes.
- [ ] Both pass `--repeat-each=5`.
