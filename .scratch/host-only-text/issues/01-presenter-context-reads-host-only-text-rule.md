# 01: The presenter context reads the shared host-only text rule

**What to build:** A single shared **host-only text** rule says which host-only text belongs to an On-air screen. /remote's presenter context takes its round note and question notes from it. A quiz master sees exactly the same notes on /remote as before, on every screen.

See the spec's "The host-only text rule" and "/remote (the presenter context)" sections.

Parent spec: `.scratch/host-only-text/spec.md`

**Blocked by:** None (can start immediately)

**Status:** done

- [ ] The rule is one pure function in shared types, beside the round note helpers. Given the quiz's seeded rounds and an On-air screen, it returns a round note and question notes, each empty when there is none.
- [ ] The round note is the on-air round's note on the round intro, the break round intro and the reveal intro, whatever the round's show-on-screen setting. It is empty on every other screen.
- [ ] The question notes are the notes of the question on the question, locking, break review or reveal screen, looked up by question id across the rounds. They are empty otherwise.
- [ ] The presenter context's round note and question notes come from the rule. Its private "question on screen" switch and its notes search are deleted. If nothing else uses the round-note-on-air helper, it is deleted or folded into the rule.
- [ ] The presenter context payload shape and its admin-room-only channel are unchanged.
- [ ] Every existing presenter context real-store spec case passes unchanged:
  - notes for the open question;
  - notes kept free of the braces settings;
  - the revealed question's notes and a break review question's notes;
  - none for a revealed question without notes;
  - the round note on the round intro and the reveal intro;
  - a closest-guess question's notes through its reveal.
- [ ] Typecheck, lint and tests pass.
