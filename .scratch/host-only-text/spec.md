# Spec: One host-only text rule per On-air screen

Status: ready-for-agent

Source: architecture review 2026-10-21, candidate 4 ("Worth exploring", in-process).

## Problem Statement

The quiz master sees host-only text in two places: the **Round note** and the **Question notes**, text the room never reads on the big screen.

- **/remote**, on the night, shows the host-only text for whatever the big screen has on air.
- **The Quiz preview's host-only panel**, before the night, shows the host-only text for each screen being previewed, so the quiz master can check what they'll be reading out.

Each works out "which host-only text belongs to this screen" with its own rule, and the two rules disagree.

- **The round note on the reveal intro.** /remote shows the round note on the round intro, the break round intro and the reveal intro. The Quiz preview's panel shows it only on the round intro. On the reveal intro, where the big screen never shows the note, the preview's panel is empty. A quiz master checking the quiz never sees the note they'll be reading before the answers. This was missed when the recent change added the round note to /remote on the reveal intro.
- **The question notes lookup.** /remote finds a question's notes by searching every round for the question's id. The preview finds them from the round and question index of the step. Both work today. Still, two lookups for one fact means a change to how notes are stored has two places to update.
- **The "already on screen" rule.** The preview leaves out a round note that the big screen already draws, which is right for a panel showing "what the room doesn't see". It decides this by re-reading the round's show-on-screen setting and the screen kind, a second copy of the rule the Display screen already applies when it draws the note.

For a developer, "which host-only text goes with this screen" has two homes. The next notes feature (notes on another screen, a new kind of host-only text) has to remember the preview, and the last one didn't.

## Solution

A single shared **host-only text** rule says which host-only text belongs to an On-air screen:

- the round note on the round intro, the break round intro and the reveal intro;
- the question notes whenever a question is on screen (asked, locking, shown again in break review, or revealed).

Notes are looked up by question id.

- **/remote** shows exactly what the rule returns, as today.
- **The Quiz preview's host-only panel** shows what the rule returns for each previewed screen, minus a round note the previewed frame already draws. That is decided from the screen being drawn, not from a second copy of the show-on-screen setting.

What quiz masters see change:

- In the Quiz preview, the reveal intro's host-only panel shows the round note, matching what /remote will show on the night.
- Nothing else changes, in the preview or on /remote.

## User Stories

1. As a quiz master checking a quiz in the Quiz preview, I want the reveal intro's host-only panel to show the round note, so that I can check the note I'll read before the answers are revealed.
2. As a quiz master, I want the Quiz preview's host-only panel to show the same host-only text /remote will show for that screen on the night, apart from what the frame already shows, so that the preview is a faithful rehearsal of what I'll read.
3. As a quiz master, I want the Quiz preview's round intro panel still to leave out a round note the big screen shows, so that the panel only lists text the room never sees.
4. As a quiz master, I want the Quiz preview's round intro panel still to show a round note the big screen doesn't show, so that I can check it.
5. As a quiz master, I want a question's notes in the Quiz preview's panel on both its question step and its answer step, so that I can check them wherever I'll see them on the night.
6. As a quiz master, I want a closest-guess question's notes in the preview panel on its reveal, so that they behave like every other question's.
7. As a quiz master, I want steps with no note to show nothing in the panel, so that an empty panel means there is nothing to read.
8. As a quiz master, I want the panel still hidden in fullscreen, so that the frame shows exactly what the TV will.
9. As a quiz master, I want the settings written into notes in braces (a clip, a margin, a scoring mode) still kept out of the notes, in both the preview and /remote, so that I never read settings aloud.
10. As a quiz master on the night, I want /remote to keep showing the round note on the round intro, the break round intro and the reveal intro, so that this work changes nothing on the night.
11. As a quiz master on the night, I want /remote to keep showing a question's notes whenever the big screen shows that question (asked, locking, break review, revealed), as today.
12. As a quiz master on the night, I want /remote to keep showing a round note even when the big screen shows it too, so that I can read it without turning to the screen.
13. As a quiz master in the "answer after question" preview order, I want the same host-only text rule as in the "like the night" order, so that the two orders don't disagree about a screen they both show.
14. As a quiz master previewing a round with no questions, I want its title card's panel to follow the same round note rule, so that an empty round's note can still be checked.
15. As a developer adding host-only text to another screen, I want to change one rule and have both /remote and the Quiz preview follow it, so that the preview can't be forgotten again.
16. As a developer, I want question notes looked up one way, by question id, so that a change to how notes are stored has one place to update.
17. As a developer, I want the preview's "already on the frame" check to read the Display screen it draws, so that the show-on-screen rule lives only where the note is drawn.
18. As a developer, I want the host-only text rule kept out of every broadcast view, as today, so that host-only text still only travels over the admin-room channel and the preview read.

## Implementation Decisions

### The host-only text rule

- **Where it lives.** One pure function in shared types, beside the round note helpers.
- **Interface.** Given the quiz's seeded rounds and an On-air screen, it returns the screen's host-only text: a round note and question notes, each empty when there is none.
- **Round note.**
  - It is the on-air round's note on the round intro, the break round intro and the reveal intro (today's "round note screens"), and empty on every other screen.
  - It doesn't look at the round's show-on-screen setting.
- **Question notes.**
  - They are the notes of the question the screen puts in front of the room on its own: the question, locking, break review and reveal screens.
  - They are looked up by question id across the rounds, and empty when that question has none or no question is on screen.
- **No stripping.** The rule doesn't strip anything. The braces settings group is already removed from notes where the seeded rounds are loaded, for both live sessions and the Quiz preview, and that stays where it is.
- **What it replaces:**
  - the presenter context's private "question on screen" switch and its notes search;
  - its direct use of the round-note-on-air helper.

  If nothing else uses the round-note-on-air helper afterwards, it is deleted or folded into the rule.

### /remote (the presenter context)

- The presenter context's question notes and round note come from the rule, for the On-air screen the admin projection names. Its payload shape and the channel it travels on (admin room only) are unchanged.

### The Quiz preview

- **Each step's On-air screen.** Each preview step is built from a session at a progress, as today, in both orders. Each step keeps the On-air screen that progress puts on air, so the host-only text can be asked for it. Empty-round title cards get theirs too.
- **The panel's text.** A step's host-only panel is the rule's output for that On-air screen, with one subtraction: the round note is left out when the step's Display screen already draws it, meaning a round title card whose drawn note is not empty. The preview no longer reads the round's show-on-screen setting or switches on the screen kind for host-only text itself.
- **Steps that gain a note.** The preview's reveal intro steps now carry the round's note. No other step changes: the preview has no locking, break review or break round title steps.
- **Wire shape.** The step's host-only field keeps its shape: a round note and a question note, each nullable.

### Docs, in the same change

- **GLOSSARY.md:**
  - **Round note:** the Quiz preview's host-only panel shows it on the round intro (when the round doesn't show it on screen) and on the reveal intro;
  - **Quiz preview:** its host-only panel follows the same rule as the presenter remote, minus what the frame already shows.
- **DOCUMENTATION.md:** the Quiz preview's host-only text paragraph names the reveal intro's round note.
- **The `/guide` page:** no change; it doesn't describe the Quiz preview's host-only panel.

## Testing Decisions

- **What makes a good test:** it builds a Quiz preview, or drives a live session, and checks the host-only text that comes out per screen. It never calls the shared rule directly or inspects which helper ran. Confirmed with the user: no new seam.
- **The shared Quiz preview spec** (host-only text cases):
  - **New case:** a round with a note has that note on its reveal intro step in the "like the night" order.
  - **New case:** when the round shows its note on screen, the note is still on the reveal intro step (the big screen never draws it there), and still left off the round intro step.
  - **Existing cases pass unchanged:**
    - a question's notes on its question and answer steps;
    - a round note on its title card only when it isn't shown on screen;
    - nothing on steps with no note;
    - an empty round's title card.
- **The presenter context real-store spec:** every existing case passes unchanged:
  - notes for the open question;
  - notes kept free of the braces settings;
  - notes of the question being revealed and of a question in break review;
  - none for a revealed question without notes;
  - the round note on the round intro and the reveal intro;
  - a closest-guess question's notes through its reveal.
- **Frontend:** the Quiz preview panel test needs no change beyond any fixture that lists a reveal intro step's host-only text.
- **Prior art:**
  - the shared Quiz preview spec's host-only cases;
  - the presenter context spec on the real-store harness.
- **E2E:** run `pnpm e2e` once before the PR. No new journey.

## Out of Scope

- **/control's notes.** It shows the selected question's notes under its answer, and each round's note in the question browser. Neither depends on the On-air screen.
- **The big screen's own round note** (the Display screen's on-screen note on the round intro and the break round intro) and the round's show-on-screen setting.
- **Note storage:** where the braces settings group is stripped from notes, and how notes are stored or edited.
- **The preview walk:** the Quiz preview's walk and its dry-run press. That is the `dry-run-press` spec.
- **The preview's screens:** any change to which screens the Quiz preview has.

## Further Notes

- Confirmed with the user on 2026-10-21:
  - the Quiz preview keeps its "only what the room doesn't see" panel, decided from the frame it draws;
  - tests stay at the existing seams.
- **Overlap with `dry-run-press`.** That spec changes how the Quiz preview walks its "like the night" order. This one changes how each step's host-only text is attached, in the same module. The two touch different parts of it, so neither blocks the other. Whichever lands second rebases onto the first.
