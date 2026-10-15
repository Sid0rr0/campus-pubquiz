# 01: Teams report their player count

**What to build:** Right after a team joins, its lobby phone screen asks "How many players are you?" It keeps "You're in! Look for (team name) on the big screen", the waiting line and the rules link, and adds a player count card: a − / + stepper limited to 1–20 and a Send button. Send shows "Saved ✓" once the server acknowledges it, or a retry option if it was refused or failed. Once a count is saved the card collapses to "(n) players · edit", which reopens it. Answering is optional and never blocks the phone.

The count can be changed at any status from a new player count field in the phone's settings modal, with the same stepper and saved or retry feedback. A team that joins after the lobby with no count sees the same card once over whatever screen it lands on, with a dismiss control. Dismissing is remembered on that phone in localStorage (read and written inside try/catch, so the card still works without storage). A phone whose team already has a count never sees the prompt.

The **player count** is one whole number per team per session, stored in a new per-team, per-session table unique on (session, team) and cascading from both. It is not stored on the roster row, because a kick deletes that row and the count must survive a kick and rejoin. The phone sends it with a new players socket event, `SET_PLAYER_COUNT` `{ playerCount }`. The payload is Zod-validated (a whole number, 1–20) and answered with an ack. It's refused without a team link, and writing it again replaces the earlier value (last write wins). It goes through the Session write, declaring that it doesn't change scores. The join-accepted payload carries the team's `playerCount` (`number | null`), so a reconnect, a second phone or a rejoin after a kick gets it. After a change, every phone of that team receives the new count through the existing per-team sync, never through the room-wide players view. The display view and scoring are untouched.

Parent spec: `.scratch/player-count-and-team-stats/spec.md`

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Gateway harness: a team sets its count and gets an ok ack; its second connected phone receives the count; another team's phone never does
- [ ] Gateway harness: setting it again keeps the last value, and a reconnect's join-accepted payload carries it (`null` before any count is set)
- [ ] Gateway harness: after a kick and a rejoin with the team code, the join-accepted payload still carries the count
- [ ] Gateway harness: 0, 21, 2.5 and a string are refused by validation; a socket with no team link is refused; setting works in the lobby and mid-quiz; the display view doesn't change
- [ ] Phone: the lobby card's stepper stays within 1–20; Send shows "Saved ✓" on an ok ack and a retry on an error ack; it collapses to "(n) players · edit" once saved and reopens on edit
- [ ] Phone: the settings modal field shows the current count and sends a change
- [ ] Phone: a team joining after the lobby with no count sees the card once; dismissing hides it for good on that phone; a team with a count never sees it
- [ ] `DOCUMENTATION.md` documents the event, the join-accepted field, the team sync and the lobby phone screen
