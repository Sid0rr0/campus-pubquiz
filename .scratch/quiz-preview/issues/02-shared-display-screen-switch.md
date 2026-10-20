# 02: Share the display screen switch outside `/display`

Status: ready-for-agent

Spec: [Quiz preview](../spec.md)

**What to build:** A prefactor with no change in behaviour. The switch that picks a component for each **Display screen** kind moves out of the `/display` page into a shared component, so another page can draw a `DisplayScreen` exactly as the big screen does. It takes the screen, the quiz-level context the screens read (settings, quiz structure, round titles, categories and authors) and, optionally, the live context only a session has (teams, answered count, media fullscreen/pause/replay, kahoot deadline, connection, the pick-another-game and winner-celebrated callbacks). With no live context, live-only parts draw empty, and a slot whose size affects the layout (such as the answered count) keeps its place.

**Blocked by:** None (can start immediately).

- [ ] `/display` draws every screen kind through the shared component and looks and behaves exactly as before.
- [ ] The shared component draws `round_overview`, `round_title`, `question`, `break_intro`, `reveal_intro` and `reveal` (both reveal kinds) without any live context.
- [ ] Every existing `/display` test stays green; a new test draws those kinds without live context and finds no team counts, roster or fun facts.
