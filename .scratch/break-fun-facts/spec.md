# Spec: Fun facts on the big screen during a break

Status: ready-for-agent

Blocked by: —

## Problem Statement

While the quiz master grades in a break, the big screen shows "BREAK", the time it ends and the bonus list for minutes on end. The room has nothing to talk about, though the session already holds plenty of story: who was fastest, which question split the room, what nobody got.

## Solution

The break screen rotates through **fun facts** (see `GLOSSARY.md`) about the session so far. A fun fact is built only from blocks already revealed, or from figures that give no answer away. It never says anything about the block in play, whose answers stay hidden until its reveal. A fact with no data is skipped. At the first break, nothing has been revealed yet, so only the figures that give nothing away appear there.

## User Stories

1. As someone in the room, I want something to read on the big screen during a break, so that the wait is fun.
2. As a team, I want to see our name when we did something notable, so that we get our moment.
3. As a quiz master, I want fun facts never to give away the block being graded, so that the reveal still lands.
4. As a quiz master, I want no fun facts shown when there's nothing worth saying, so that the screen never shows "0 teams…" filler.

## Fun facts (first set)

From revealed blocks:
- **Fastest correct answer**: the team and its time, from kahoot questions only (only there is response time a race).
- **Toughest question**: the lowest correct rate (the stats definition: credit by verdict), with the question number and its text.
- **Room split**: the question whose correct rate is closest to 50%.
- **Nobody got it**: a question with no correct answer.
- **Clean sweep**: teams that got every question of the last revealed block fully correct.

Figures that give nothing away (any break):
- **Answers so far**: the total number of answers submitted in the session.
- **Bonus awards so far**: counts per bonus category (e.g. "7 shots, 3 selfies"), counting positive awards only.

## Implementation Decisions

- One pure module turns the session's revealed answers, verdicts and bonus awards into an ordered list of fun facts. The server owns it: the display view carries `funFacts` on the break screen, already filtered, and `/display` only draws them. This follows server-owned game state in `CODING_STANDARDS.md`.
- "Revealed" means the blocks before the block in play (the Block module answers which those are). The block in play is never read.
- The facts are worked out when the break starts and when grading changes a revealed answer. They aren't recomputed per broadcast if the Standings read already covers that data; reuse it where it does.
- `/display` rotates the facts every `FUN_FACT_ROTATE_MS` (8 s) under the BREAK heading, keeping "Back at…" and the bonus list. It shows nothing when the list is empty.
- The phones and `/control` are unchanged.

## Testing Decisions

- The pure module: each fact from a hand-built session; nothing from the block in play; facts with no data skipped; the first break yields only figures that give nothing away; fastest-answer ignores non-kahoot questions.
- The display view carries `funFacts` only on the break screen.
- The break screen rotates (fake timers) and renders nothing for an empty list.

## Out of Scope

- Fun facts on the phones, at the reveal or on the ended screen.
- Settings to choose or turn off individual facts. Add them only if asked.
