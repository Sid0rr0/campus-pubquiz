---
version: 1
slug: "apps-frontend-app-page-tsx"
primary_target: "apps/frontend/app/page.tsx"
related_targets: ["apps/frontend/app/components/join-panel.tsx","apps/frontend/app/components/how-it-works.tsx"]
---

Scope: `/` homepage. Mode: Persuade (front door; the action is joining a game). Teams arrive on phones at the venue (the projector QR goes to /play), plus league visitors and staff.

Job: make what the app does clear in one look, then get a team into a game in seconds. Constraints: keep JoinForm/JoinPanel behaviour (connecting/joined states, ?code= prefill, returning-team code, unlisted game code); established world from DESIGN.md.

## Direction contract

THESIS: Joining is getting a ticket. The join card is a ticket that admits one team. This refuses the default arrangement of a centred hero, a row of equal step cards and then a form.

OWN-WORLD: ink band with cream type at the top; a white ticket card with an accent-1 header strip, a dashed perforation, and a tear-off stub for the team code. Accent-1 primary button on its ledge. Technika throughout.

STORY: the visitor reads what the app does (features on the ink band), sees the ticket, writes the team name, picks tonight's game, and joins. Returning teams use the stub.

FIRST VIEWPORT: a compact ink band holds the title, the short tagline and the features. On desktop the features are a ruled list; on phones they are an unruled tight stack, so the perforation stays inside 844. The ticket overlaps the band's lower edge, centred and at most 28rem wide. Its header "Admit one team" is set in display type, and the Join button sits inside the first phone screen at 390x844 when no error is showing. On desktop the band holds the title and features side by side.

FORM: ticket (rank 6 of 7 grounded structures, dealt), seed:8f44691046233e19. The user asked to keep the app's features at the top.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
