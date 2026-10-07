# 04: A re-import goes through the Live edit module

**What to build:** Re-importing a sheet can never break a game another session is playing on the same quiz. Today the import only checks that the importing session is in the lobby or has ended. It finds the quiz by title and replaces its rounds and questions with no frontier check, even if another session is live on that quiz.

When the imported quiz has live sessions, the re-import saves through the Live edit module from ticket 03, so it's checked against their frontier and applied under their held writes exactly like an editor save. The importing session's own lobby-or-ended rule stays. The importing session's lobby or ended screens are still broadcast the new rounds, through the same outcome. The gateway's "quiz edited" notification is removed once nothing calls it.

Docs in the same commit: `DOCUMENTATION.md`'s live-edit section adds that a re-import onto a quiz another session is playing is checked the same way.

Parent spec: `.scratch/live-edit-save/spec.md`

**Blocked by:** 03

**Status:** ready-for-agent

- [ ] Written first, failing against today's code: a re-import from a lobby session onto a quiz another session is playing, changing that session's opened part, is refused with the live-edit issues, and the playing session is unchanged.
- [ ] A re-import that only changes the unopened part is allowed, and both sessions are broadcast the reloaded quiz.
- [ ] A re-import onto a quiz with no live session behaves as today, including the importing session's broadcast.
- [ ] The quiz-reimported and import specs pass; nothing calls the gateway's quiz-edited notification any more.
- [ ] DOCUMENTATION is updated in the same commit.
