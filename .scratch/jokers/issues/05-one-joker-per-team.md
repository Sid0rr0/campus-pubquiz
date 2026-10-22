# 05: One joker per team

**What to build:** Every team in a joker session always holds exactly one joker. A team that joins during the pick picks like everyone else; one that joins after it closed is drawn a round that hasn't started. A team that is kicked and rejoins with its name and code gets its joker back. A live edit that deletes a team's joker round redraws it inside the same save; a reorder leaves the joker on its round. Each change the team didn't make shows the change toast.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 03, 04

**Status:** ready-for-agent

- [ ] Join during `joker_pick`: the phone gets the picker
- [ ] Join after the pick closed: a drawn joker from the pickable rounds, with the toast
- [ ] Kick and rejoin keeps the joker (the joker row survives the roster row's deletion)
- [ ] Deleting a joker round through a Live edit save redraws every joker on it in the same save and syncs the teams; reordering rounds keeps jokers on their round
- [ ] Real-store harness specs for each case
- [ ] `DOCUMENTATION.md` updated
