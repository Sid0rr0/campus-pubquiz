---
name: Campus Pub Quiz
description: A live pub quiz for the big screen, the quiz master's laptop and every team's phone.
colors:
  accent-1: "#ec008c"
  accent-1-ledge: "#b8006d"
  accent-2: "#00aeef"
  accent-3: "#7ac143"
  accent-3-ledge: "#5c9132"
  accent-4: "#f47b20"
  accent-5: "#ffc60b"
  ink: "#2e3192"
  surface: "#fbf8f1"
  surface-raised: "#ffffff"
typography:
  display:
    fontFamily: "Technika, sans-serif"
    fontSize: "4.5rem"
    fontWeight: 400
    lineHeight: 1.25
  headline:
    fontFamily: "Technika, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 800
    lineHeight: 1.33
  title:
    fontFamily: "Technika, sans-serif"
    fontSize: "1.125rem"
    fontWeight: 800
    lineHeight: 1.55
  body:
    fontFamily: "Technika, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 700
    lineHeight: 1.43
  label:
    fontFamily: "Technika, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 800
    lineHeight: 1.33
    letterSpacing: "0.025em"
rounded:
  sm: "6px"
  md: "8px"
  lg: "12px"
  xl: "16px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  lg: "16px"
  xl: "24px"
  header: "64px"
components:
  button-primary:
    backgroundColor: "{colors.accent-1}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.xl}"
    height: "56px"
    typography: "{typography.title}"
  button-primary-flat:
    backgroundColor: "{colors.accent-1}"
    textColor: "{colors.surface-raised}"
    rounded: "{rounded.md}"
    padding: "6px 12px"
  button-outline:
    backgroundColor: "transparent"
    textColor: "{colors.accent-2}"
    rounded: "{rounded.md}"
    padding: "0 16px"
    height: "40px"
  button-icon:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    size: "32px"
  input-field:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "0 16px"
    height: "56px"
  card:
    backgroundColor: "{colors.surface-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.xl}"
    padding: "16px"
  status-badge:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.surface}"
    rounded: "{rounded.md}"
    padding: "4px 12px"
---

# Design System: Campus Pub Quiz

## Overview

**Creative North Star: "The Student Union Scoreboard"**

Loud, friendly and as bright as a poster, built to be read across a pub. Ink-blue type and six saturated brand colours sit on a warm cream background. Almost everything is set extra-bold, and the big screen's type grows with a size control so the back row can read it. Surfaces are mostly flat white cards on cream, and the main action stands out with a chunky raised button.

The system covers three settings at once: a projector (`/display`), a laptop control room (`/control`) and phones in a dim, noisy room (`/play`). It is dense enough for the quiz master's grading screens and loud enough for the room, and the same colour family runs through all of them.

This record describes the current system, not a final one. The owner is open to new or different styles, and theming for other organisers is planned. Treat the rules below as the current baseline. A deliberate new direction through `/impeccable` can replace them; drifting away from them one screen at a time should not.

**Key Characteristics:**
- Ink-blue (not black) text on warm cream, with white cards on top.
- One colour leads (accent 1); the other four accents encode meaning or step order.
- Extra-bold type everywhere; the display headline is the only regular-weight element.
- Soft, generous corners (8–16px), with circles and pills for numbers and tags.
- Flat by default; the primary action sits on a solid colour ledge.
- Big-screen type scales from one variable, `--display-text-scale`.

## Colors

The palette is ESN's brand colours: one dominant accent, four supporting ones, and ink blue on cream for everything else. Colour token names are deliberately generic (accent 1–5) so a future theme can swap the colours without renaming them. In CSS, the same colours are currently named after the hues (`--color-magenta` and so on).

### Primary
- **Accent 1** (`--color-magenta`): the brand voice. Used for the wordmark, the primary button, links that matter, destructive-icon outlines and error or warning text. It is by far the most-used accent.
- **Accent 1 Ledge**: the darker shade under the primary button that makes it look pressable. Not used on its own.

### Secondary
- **Accent 2** (`--color-cyan`): secondary actions (outline buttons) and the second step in numbered sequences.

### Tertiary
- **Accent 3** (`--color-green`): correct answers, success and confirmation, and the third numbered step. Its ledge shade (accent 3 ledge) raises the green confirm button.
- **Accent 4** (`--color-orange`) and **Accent 5** (`--color-yellow`): rare highlights such as jokers, podium places and attention markers. Keep them scarce.

### Neutral
- **Ink** (`--foreground` / `--color-dark-blue`): all text, plus borders and dividers at reduced opacity. Muted text uses 55–70% opacity, and hairlines and card borders use 10–35%. The hero band on the landing page is solid ink.
- **Surface** (`--background`): the warm cream page background. It is also the text colour on ink fills.
- **Surface Raised**: white, used for cards, inputs and dropdowns.

### Named Rules
**The Ink, Not Black Rule.** Text, borders and dark fills are ink at some opacity. There is no grey scale; use a lighter shade of ink instead.

**The One Loud Voice Rule.** Accent 1 is the action and brand colour. The other accents mean something (step order, correct, highlight) and are never used as a second "primary".

## Typography

**Display Font:** Technika (with sans-serif fallback)
**Body Font:** Technika (with sans-serif fallback)

**Character:** a single technical-geometric sans used for every role. Weight does the work: nearly everything is extra-bold, which gives the chunky, scoreboard feel. Technika ships only a regular weight (400, plus italic), so the browser synthesises the bold weights (`font-bold`, `font-extrabold`). Whether to load real bold weights or change the font is an open decision.

### Hierarchy
- **Display** (regular, 3rem on mobile, 4.5rem from `sm`, line-height 1.25): the landing-page hero title only.
- **Headline** (extra-bold, 1.5rem): page and section titles, and big-screen titles (via `text-display-2xl`).
- **Title** (extra-bold, 1.125rem): card titles, primary button labels and input text.
- **Body** (bold, 0.875rem): the default for controls and descriptions on staff screens.
- **Label** (extra-bold, 0.75rem, wide tracking, sometimes uppercase): metadata, badges, header nav, and join and team codes (uppercase with the widest tracking).

### Big-screen scale
`/display` uses its own sizes, `text-display-sm` through `text-display-6xl`, plus `text-display-8xl` (6rem) reserved for the round title card. These are Tailwind's sizes multiplied by `--display-text-scale`, which the operator sets from a text-size control.

### Named Rules
**The Back-Row Rule.** Every size on `/display` comes from the `text-display-*` scale so the text-size control reaches it. A fixed `text-*` size on the big screen is a bug.

## Layout

Tailwind's 4px spacing grid. Most gaps are 4–16px, and cards and sections use 16–24px. The site header is a fixed 64px (`--site-header-height`), with the wordmark on the left, nav on the right, and an optional element centred in the bar.

- **Phones (`/play`, landing join):** one column, full-width tall controls (48–56px). Nav moves into a hamburger drawer below `md` (below `xl` when signed in, since the staff nav is long).
- **Staff (`/control`, authoring, tables):** denser. Small buttons (`xs`/`sm`), sortable tables, sticky side panels. `/control` has its own mobile drawer and hides the site header below `md`.
- **Big screen (`/display`):** the site header is hidden. Each status screen fills the viewport with its own header (round/question badge), and a team list that overflows scrolls sideways in a loop.
- **Landing:** an ink hero band (title, tagline, and the app's features as a ruled list on desktop), with the join ticket overlapping its lower edge, then the three steps as one line of small print.

## Elevation & Depth

Flat surfaces and contrast between colours. Depth mostly comes from white cards on the cream page with a thin ink border at low opacity. Real shadows are rare and have specific jobs.

### Shadow Vocabulary
- **Button ledge** (`box-shadow: 0 3px 0 #b8006d`; green version `0 3px 0 #5c9132`): a solid, unblurred offset under primary and confirm buttons, so they read as physical keys.
- **Card lift** (`box-shadow: 0 10px 24px rgba(46,49,146,0.08)`, larger `0 16px 36px rgba(46,49,146,0.1)`): a soft, ink-tinted glow under feature cards on the landing page.
- **Popover** (Tailwind `shadow-lg`): dropdowns and menus that float above content.

### Named Rules
**The Ledge, Not Glow Rule.** Buttons are raised with a hard, coloured offset, never a blurred drop shadow. Blurred shadows belong only to cards and floating menus.

## Shapes

Soft and friendly. Corners scale with element size: 6–8px on small buttons and icon buttons, 12px on mid-size controls, and 16px on cards, primary buttons, inputs and dropdowns. Fully round shapes are reserved for counters, step numbers and pill tags. Borders are 2px on interactive controls and 1px on passive containers. Dashed 2px borders mark empty slots or "add" actions.

## Components

### Buttons
Chunky and tactile. Everything renders through the shared `Button` component (`apps/frontend/app/components/button.tsx`), which keeps only variants used three or more times.
- **Shape:** 8px on small buttons; 12–16px on large phone buttons.
- **Primary (`solid`):** accent 1 fill, white Technika label at 1.125rem, 48–56px tall, sitting on the accent-1 ledge.
- **Primary flat (`solid-flat`):** the same fill without the ledge, for compact staff toolbars.
- **Outline:** 2px accent-2 border with accent-2 text. **Outline muted / dashed:** 2px ink border at 30% opacity; dashed for "add" slots.
- **Icon / icon-danger:** square 28–36px buttons with a 2px border (ink at 20%, or accent 1 at 30% for danger); disabled at 30% opacity.
- **Text quiet:** small extra-bold underlined text in ink at 45%, for secondary escape links.
- **Hover / Focus:** buttons get a pointer cursor but no hover style, and focus uses the browser's default outline. There is no custom focus ring yet; this is a gap.

### Inputs / Fields
- **Style:** white fill, 2px ink border at 35%, 16px corners, 56px tall, 1.125rem bold text. Codes are uppercase with the widest tracking.
- **Focus:** browser default (see the Buttons gap).

### Cards / Containers
- **Corner style:** 16px.
- **Background:** white on cream; occasionally cream at 60% for sticky side panels.
- **Border:** 1px ink at 15%.
- **Shadow:** none, or card lift on landing feature cards.
- **Internal padding:** 12–16px on staff screens, more on the landing page.

### Navigation
The header sits on cream with no border. The wordmark is in accent 1, extra-bold, on the `display-xl` size. Nav items (`.nav-item` in `globals.css`) are extra-bold, small, widely tracked and not underlined; hover gives a faint ink tint, and the current page (`aria-current`) is an ink pill with cream text, matching the selected league tab. Below `md` (`xl` when signed in), links move into an ink drawer that slides in from the right: full-width rows at least 48px tall, with the current page as a cream pill and Log out set apart and muted. On `/play` the drawer leads with the team code block, then Settings and Change team.

### Status badge
A small ink-filled pill with cream text, used in the big-screen header for round/question position.

### Round title card (ink stage)
The between-rounds peak on `/display` (round title, break round title, reveal intro). It fills the whole area under the header with solid ink, like the landing hero. The round name is in cream at `text-display-8xl` (max 18ch, balanced), the author and note are in cream at 70–85%, and the round label (e.g. "ROUND 2 — History", "REVEALING ANSWERS · ROUND 1") is an accent-1 pill below the title, not an eyebrow above it. The label comes in first, then the title (`round-title-entrance.tsx`). It is the only full-bleed ink screen on `/display`; keep it that way so it still reads as a change of pace.

### Join ticket (landing)
The landing page's join card is a ticket (`join-panel.tsx`): an accent-1 header strip reading "Admit one team" in display type, the join form, then a dashed perforation with cream notch discs at both edges and a tear-off stub. Collapsed, the stub reads "Played before? Keep this stub." with a tracked uppercase TEAM CODE control. Revealed, it holds the returning team's code field. It uses the card-lift shadow and overlaps the ink band by 56–80px.

### Leaderboard & podium (signature)
The ranked leaderboard and podium on `/display` reveal one rank at a time, using staged entrance animations (`leaderboard-entrance.ts`, `podium.tsx`) and a fanfare sound. They are the climax of the night and the most expressive moment in the system.

## Do's and Don'ts

### Do:
- **Do** colour text and borders with ink at some opacity: 55–70% for muted text, 10–35% for borders.
- **Do** raise the primary action on a solid accent ledge (`0 3px 0` with a darker shade of the same accent).
- **Do** size every `/display` element from the `text-display-*` scale.
- **Do** keep accent 2–5 tied to meaning: step order, correct, highlight.
- **Do** give `/play` controls a height of at least 48px and full width on phones.
- **Do** honour `prefers-reduced-motion`, fading opacity only, as the break fun-fact entrance does.

### Don't:
- **Don't** introduce greys or pure black for text; use ink.
- **Don't** add one-off button variants to `Button`; keep single-use styles as classes at the call site, as `button.tsx` does today.
- **Don't** use a blurred drop shadow to raise a button.
- **Don't** hard-wire ESN-specific colour names into new tokens; use role names so a theme can swap them.
