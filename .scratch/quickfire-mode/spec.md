# Spec: Quickfire is a quiz mode, not a round setting

Status: done

Blocked by: none

Source: grilling session 2026-11-06/07 ("disconnect the kahoot round from the other rounds - make it different game mode").

## Problem Statement

A kahoot round is a per-round flag (`kahootMode`) inside an ordinary quiz. Mixed into a pub quiz it puts 1000-point speed scores on the same board as 1-point pub answers, and every pub-quiz feature (jokers, power-ups, breaks, live edits, prior standings, feedback, leagues) carries its own exception for the odd round. "Kahoot" is also a trademark sitting in user-facing copy.

## Solution

Every quiz has a **quiz mode**: pub quiz or **quickfire quiz** (see `GLOSSARY.md`), chosen at creation and never changed. A quickfire quiz plays every round the way a kahoot round plays today. The why is in ADR 0005.

## Implementation Decisions

- **Rename.** "kahoot" becomes "quickfire" everywhere: identifiers, file names, DB columns, payload fields (`kahootQuestionEndsAt`, `kahootQuestionTimerSeconds`, `revealedKahootQuestionIds`…), copy, docs, ADR 0001 (file and wording, plus one line that the rule now applies to the whole quiz). Done first, with no behaviour change (ticket 01).
- **Where the mode lives.** A `mode` column on `quizzes` (`pub` | `quickfire`). `rounds.kahoot_mode` is dropped. The engine keeps its in-memory per-round flag, filled from the quiz's mode when a session's rounds are seeded (`seed.service.ts`, `session-state.ts`), so block, reveal, timer and prior-standings logic is untouched and engine specs keep their per-round fixtures.
- **Migration.** A quiz whose rounds are all `kahoot_mode` (and that has at least one round) becomes `quickfire`, every other quiz `pub`; the migration throws on a quiz with both kinds of round. There is no split: no such quiz exists.
- **Rounds stay.** A quickfire quiz keeps rounds (title, category, author, intro, note). `break_after` is ignored in it (already true for kahoot rounds) and hidden in the editor.
- **Question types.** A quickfire quiz accepts only the quickfire-allowed types (ADR 0001), checked by the draft schema and the importer. A blank points cell / new question defaults to 1000 in a quickfire quiz, 1 in a pub quiz.
- **Mode is chosen at creation.** The new-quiz form and CSV/Sheets import offer pub / quickfire, default pub. The CSV format is unchanged. The editor shows the mode read-only.
- **Dropped in a quickfire session.** Jokers, power-ups, coins (starting, carried) and coin awards. Hidden in the start dialog and lobby settings, and refused by the server.
- **Kept in a quickfire session.** Bonus awards, the showdown, final-form feedback, the `fastest_correct_answer` fun fact, the question timer (always shown, prefilled 30 s).
- **Leagues.** A quickfire session can't be added to a league (refused, picker hidden), and a league table skips any quickfire session already in it (sessions of migrated quizzes).
- **Team stats.** Sessions played counts quickfire nights; Wins (night won) and Average placing don't, on the team page, the staff team page and the team directory.
- **Team directory filter.** A "Show quickfire-only teams" checkbox next to the search, unchecked by default and not remembered; it is a server query parameter and resets to page 1. A **quickfire-only team** took part in at least one ended session, all quickfire.
- **Labels.** Quiz list and session picker show "Quickfire" on quickfire quizzes/sessions.
- **Docs.** Each ticket updates `DOCUMENTATION.md`, `/guide` and `/how-to-play` for what it changes (CLAUDE.md "Keeping docs current"). `GLOSSARY.md` and ADR 0005 are already written.

## Testing Decisions

- Engine behaviour is unchanged, so existing engine specs only follow the rename.
- New logic gets specs where it lives: the migration's classification (incl. the throw on mixed), the draft schema's mode/type rule, the server refusals (power-ups, jokers, coin awards, league add), the league table skip, the Wins/Average placing exclusion, the quickfire-only filter.
- E2E: `full-night` loses its kahoot round (a pub quiz can't hold one); `kahoot-round.spec.ts` becomes `quickfire.spec.ts`, seeding by importing with mode quickfire.

## Out of Scope

- Changing a quiz's mode after creation, or duplicating a quiz into the other mode.
- A quickfire league or any quickfire ranking across nights.
- Splitting mixed quizzes in the migration.
