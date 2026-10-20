# 06: Host-only panel and fullscreen

Status: done

Spec: [Quiz preview](../spec.md)

**What to build:** Next to the frame, a panel labelled "host only" shows the text the room never sees for the current step: the question's notes, and the round note when the round doesn't show it on the big screen. Each preview step carries that text from the Quiz preview module. A fullscreen toggle shows the 16:9 frame alone at full size, with the panel, jump list and controls hidden; arrow keys still step, and Escape leaves fullscreen.

**Blocked by:** 05.

- [ ] Module tests: a question with notes carries them; a round whose note is shown on screen carries no host-only round note (it is on the title card); one whose note is hidden carries it; steps with neither carry none.
- [ ] Page tests: the panel shows the current step's host-only text and an empty state when there is none; fullscreen hides the panel and controls, keeps arrow-key stepping, and leaves on Escape.
