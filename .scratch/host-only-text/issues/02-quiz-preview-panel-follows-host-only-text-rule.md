# 02: The Quiz preview's host-only panel follows the shared rule

**What to build:** In the Quiz preview, each step's host-only panel shows what the shared host-only text rule returns for that step's On-air screen, minus a round note the previewed frame already draws. A quiz master checking a quiz now sees the round note on the reveal intro, matching what /remote shows on the night. Every other step's panel is unchanged.

See the spec's "The Quiz preview" and "Docs" sections.

Parent spec: `.scratch/host-only-text/spec.md`

**Blocked by:** 01

**Status:** done

- [ ] Each preview step keeps the On-air screen its progress puts on air, in both orders, including an empty round's title card.
- [ ] A step's host-only panel is the rule's output for that On-air screen. The round note is left out only when the step's Display screen already draws it: a round title card with a non-empty drawn note.
- [ ] The preview no longer reads the round's show-on-screen setting or switches on the screen kind for host-only text.
- [ ] The step's host-only field keeps its shape: a round note and a question note, each nullable.
- [ ] The shared Quiz preview spec gains two cases:
  - a round's note is on its reveal intro step in the "like the night" order;
  - when the round shows its note on screen, the note is still on the reveal intro step and still left off the round intro step.

  Every existing host-only case passes unchanged.

- [ ] The frontend Quiz preview panel test passes. Only a fixture listing a reveal intro step's host-only text may change.
- [ ] Docs, in the same change:
  - GLOSSARY.md's **Round note** says the Quiz preview's host-only panel shows it on the round intro (when the round doesn't show it on screen) and on the reveal intro;
  - GLOSSARY.md's **Quiz preview** says its panel follows the presenter remote's rule minus what the frame already shows;
  - DOCUMENTATION.md's Quiz preview host-only paragraph names the reveal intro's round note.
- [ ] Typecheck, lint and tests pass. Run `pnpm e2e` once.
