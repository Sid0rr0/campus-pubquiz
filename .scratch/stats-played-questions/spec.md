# Spec: Unplayed questions stay out of an ended session's stats

Status: done

Blocked by: none

Source: architecture review 2026-10-28, candidate 1 ("Count the opened questions in the session detail module"). Seams agreed with the user in the same session.

## Problem Statement

A quiz master can end a quiz before every question has been shown (End quiz). On the stats page and in the Night brief, each question the session never opened counts as answered by nobody. Its correct rate is 0%, so it:

- can be named the **Hardest question** on the stats page and in the Night brief, and can make its round the **Hardest round**;
- appears in the "no team got it right" list;
- drags its round's correct rate and points % down, which can also make that round the Hardest round.

The Night brief already knows which questions were never opened and writes "(not played)" under them. But its Highlights section comes from the stats page's figures, so one brief can say both "Hardest question: Round 4 Q2 …" and, further down, "Round 4 Q2 … (not played)". Whoever writes the next quiz then gets a wrong picture of what was hard.

The cause is that two places decide which questions a session played, in two different ways. The session detail treats every quiz question as played. The Night brief reads the session's stored opened questions, and for sessions saved before opened questions were tracked it falls back to "every question up to the last one with an answer".

## Solution

The session detail decides once which of the quiz's questions the session played, and every figure that describes how a question or round went uses only those questions. The stats page and the Night brief both read that one answer, so they can no longer disagree.

A question counts as played when the session opened it, or when it has at least one stored answer. For a session saved before opened questions were tracked, the played questions are every question up to the last one with an answer, in play order. That is the Night brief's current rule, moved rather than changed.

An unplayed question:

- has no correct rate (shown as empty, as for a question type with no meaningful correct rate);
- is never a highlight, never in the all-correct or none-correct lists, and doesn't count towards its round's correct rate or points %;
- still appears in the questions table and the Night brief, still says "(not played)" in the brief, and still counts in the quiz's max points.

## User Stories

1. As a quiz master looking at an ended session's stats page, I want a question the session never showed to never be named Hardest question, so that the highlight points at a question teams actually found hard.
2. As a quiz master, I want an unplayed question to never be named Easiest question, so that both highlights describe played questions only.
3. As a quiz master, I want a round whose questions were never shown to never be named Hardest round, so that ending early doesn't make the last round look brutal.
4. As a quiz master, I want an unplayed question left out of the "no team got it right" list, so that the list only names questions teams really got wrong.
5. As a quiz master, I want an unplayed question left out of the "every team got it right" list, so that both lists cover the same played questions.
6. As a quiz master, I want a round's correct rate to average only its played questions, so that a round cut short shows how its played questions went.
7. As a quiz master, I want a round's points % to be measured against only its played questions' points, so that a round cut short isn't shown as half failed.
8. As a quiz master, I want a round where nothing was played to have no correct rate, so that it reads as "not rated" rather than 0%.
9. As a quiz master, I want an unplayed question to show an empty correct rate in the questions table, so that I can tell it apart from a question nobody got right.
10. As a quiz master, I want unplayed questions to still be listed in the questions table, so that I can see the whole quiz and what wasn't reached.
11. As a quiz writer reading the Night brief, I want its Highlights to never name a question it later marks "(not played)", so that the brief is consistent with itself.
12. As a quiz writer, I want a round in the Night brief to show the same correct rate as the stats page, so that the two never disagree.
13. As a quiz writer, I want the Night brief to keep marking unplayed questions "(not played)", so that I know which questions to reuse untested.
14. As a quiz master looking at a session saved before opened questions were tracked, I want the played questions inferred as every question up to the last answered one, so that old sessions get the same fix.
15. As a quiz master, I want a question that has stored answers to always count as played, even if the session's opened list doesn't include it, so that no answer ever gets hidden.
16. As a quiz master, I want a question the session opened but no team answered to count as played with a 0% correct rate, so that a question nobody even tried still shows up as hard.
17. As a quiz master, I want a session that played every question to show exactly the same figures as before, so that nothing changes for a normal night.
18. As a quiz master, I want the quiz's max points, team score shares and difficulty label to stay based on the whole quiz, so that they match the session list, team history and league.
19. As a team looking at its own team page, I want nothing to change, so that a stats-page fix doesn't change what I see.

## Implementation Decisions

- **Session detail module owns "played".** The session detail calc's input gains the session's stored opened question ids (null for a session saved before they were tracked). It moves there from the Night brief input, which already extends the session detail input, so the brief keeps receiving it.
- The played-question rule above lives in the session detail module as one private step. The Night brief's own `openedQuestionIdsOf` rule is deleted. The brief gets "played" from the detail's output: an unplayed question is a detail question row with a null correct rate whose type does have a meaningful correct rate. If that inference reads awkwardly in the brief, use another option instead: the detail calc exposes the played ids as a non-exported internal result, or the brief calls the same private helper exported from the detail module. Either way there must still be one rule. The detail's public `SessionDetailStats` shape does not change.
- **Question rows:** an unplayed question's correct rate is null. Its answered count and correct count stay as computed (both 0 for an unplayed question with no answers).
- **Round rows:** correct rate averages only played questions with a correct rate; null when there are none. Points % divides by the team count × the round's played questions' points; 0 when that is 0 (as now for an empty round).
- **Highlights:** they already skip rows with a null correct rate, so they follow from the question and round rows without separate filtering. The all-correct and none-correct lists follow the same way.
- **Max points and difficulty are not changed.** Session result's `maxPoints` stays the sum over every quiz question, as do the session list's SQL `max_points`, team history and the league. The difficulty average % keeps reading every stored answer against the whole quiz's max points.
- **Loading:** the stats module's shared session-rows loader (used by both the session detail and the Night brief) reads the session row's opened question ids. The brief's separate query for them is removed.
- The Session result module and the shared question outcome are unchanged: the played filter sits in the session detail, which is the only reader with the opened question ids.
- No schema change, no migration, no socket or REST shape change, no frontend change: the stats page already renders a null correct rate.

## Testing Decisions

- Good tests here assert what the stats page and the Night brief show for a given set of stored rows. They don't assert which helper ran or how played is computed internally.
- **Session detail calc (pure, primary seam):** add fixture cases to the existing session detail calc spec:
  - a session that opened only some questions: unplayed questions have a null correct rate, are never hardest or easiest, and are in neither the all-correct nor the none-correct list;
  - a round that was only partly played: its correct rate and points % cover only the played questions;
  - a round that was never played: null correct rate, and it can't be the hardest round;
  - an opened question with no answers: 0% correct rate, and it can be the hardest question;
  - a question with answers that is missing from the opened list: counts as played;
  - a null opened list: falls back to every question up to the last answered one;
  - every question opened: figures identical to before;
  - max points and difficulty unchanged by unplayed questions.
- **Night brief calc (pure):** the existing brief spec's opened/backfill cases (the ones that currently pin the brief's own rule) keep passing unchanged, now through the moved rule. Add one case: a session ended early whose Highlights never name a question the brief marks "(not played)", and whose round correct rate matches the detail's.
- **Stats service (DB-backed, loading seam):** in the stats service spec, extend the session detail wiring case, or add one, so that a session whose row stores opened question ids gets a null correct rate on an unopened question. The existing "reads a question as not played unless the session row says it was opened" brief case must keep passing.
- Prior art: the session detail calc spec (pure fixtures through `computeSessionDetail`), the session brief calc spec, and the `getSessionDetail` / `getSessionBrief` blocks in the stats service spec.

## Out of Scope

- Changing max points, team score shares, the difficulty label, the session list's max points, team history or the league for a session ended early. These all use the whole quiz's max points and must stay consistent with each other. Changing them is a separate decision across all of those readers.
- A "not played" label on the stats page's questions table (it shows an empty correct rate instead).
- Collapsing the saved progress type names or the opened/revealed backfills in the live game (architecture review candidate 5).
- The live game's own opened-question backfill on restore. It is a different rule for a different purpose (which questions the live editor must freeze) and stays as is.

## Further Notes

- `DOCUMENTATION.md`: if it describes how the stats page's highlights or correct rates are computed, add that unplayed questions are left out. No `GLOSSARY.md` change: "opened question" already covers the term, and "played" here means opened or answered.
- No `/guide` change: nothing on `/control` changes.
