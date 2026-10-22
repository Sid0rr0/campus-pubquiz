# 09: Big-screen joker pick: names ticking off and sound

**What to build:** During the joker pick the big screen ticks off team names as they pick (never saying which round) and shows "N/M picked". The lock-countdown music plays from when the pick opens (it runs 60 s, so it ends as the pick closes) and stops if the pick closes early; the time-up sound plays once when the pick closes. The existing countdown-sound setting, relabelled "Countdown sound", and the big-screen mute govern both countdowns.

Parent spec: `.scratch/jokers/spec.md`

**Blocked by:** 02

**Status:** ready-for-agent

- [ ] Display view on `joker_pick` carries the ids of teams that have picked; the screen shows their names and "N/M picked"
- [ ] `soundFor`: countdown track on entering `joker_pick` live, stopped on leaving early; `time-up` once on leaving it forward; keeps playing under an overlay like the lock countdown
- [ ] Both follow `playLockCountdownSound` (field name unchanged, label "Countdown sound") and the big-screen mute
- [ ] Real-store harness spec for the picked ids; `soundFor` and page specs
- [ ] `DOCUMENTATION.md` (sound table, settings) and `/guide` updated
