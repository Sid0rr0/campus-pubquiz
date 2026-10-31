# Spec: Power-ups and coins

Status: ready-for-agent

Blocked by: —

## Problem Statement

Teams have one lever on their score besides answering: the joker. A quiz night has dead air the moderator would like to fill with tactics, and staff want more teams to leave round ratings. Shots and selfies earn bonus points but nothing else.

## Solution

A session can be played **with power-ups**. Each team gets **coins** (never points) and spends them on its phone for one-off helps: **50/50**, **first letter**, **letter count**, **pin one**, **wider margin**, **ask the room** and the **extra joker**. Teams earn more coins from shots and selfies, and from **coin awards** the quiz master gives or takes. A team that rated every round of its last night in the league brings a **carried coin**, which it can spend even in a session played without power-ups. When a question is revealed, the big screen shows the **power-up count**.

Every term above is defined in `GLOSSARY.md` (Power-ups section).

## User Stories

1. As a moderator, I want a Power-ups tab when I create a session, so that I can switch power-ups on and set them up before the night.
2. As a moderator, I want to set the starting coins (default 2), so that I control how many power-ups are in play.
3. As a moderator, I want to choose which power-ups are offered, their cost and how many times a team may use each in the session (default once), so that I can tune the night.
4. As a moderator, I want to change the same settings in the lobby until the quiz starts, so that I can fix a mistake.
5. As a team, I want to see my coins next to my score, so that I know what I can buy.
6. As a team, I want to buy a power-up on the question I'm answering, so that I get help when I need it.
7. As a team, I want a 50/50 on a multiple-choice question to leave half the options (rounded down, never fewer than two) with the right one among them.
8. As a team, I want the first letter, or the letters as blanks, of a free-text answer.
9. As a team, I want one item placed or one pair matched for me, locked in, on a sort or match question.
10. As a team, I want a doubled margin on a Number question, or the default ±10% where it has none.
11. As a team, I want to see how the other teams' answers split on a multiple-choice question, as percentages, once at least three other teams have answered.
12. As a team, I want to double the next round with an extra joker, seeing its title when the round overview was shown, or just its number (cheaper) when it wasn't.
13. As a team, I want a power-up's effect to stay the same after my phone reconnects.
14. As a team, I want a coin with every shot and selfie bonus award, with a toast.
15. As a moderator, I want to give or take coins in the same form as bonus awards, kept separate from bonus points.
16. As a team that rated every round of our last league night, I want a coin to spend tonight, even if tonight has no power-ups.
17. As a moderator, I want a Coins column in the teams table and to see which power-ups each answer used, so that I can settle disputes.
18. As the room, I want the big screen to show how many of each power-up were used when a question is revealed, without naming teams.
19. As a team, I want the rules screen to tell us power-ups are on and how to earn coins.
20. As a moderator running a quiz night, I want the guide to explain power-ups and coin awards.

## Implementation Decisions

- **Settings** (shared types `SessionSettings`): `powerUpsEnabled`, `startingCoins` (default 2), and a per-power-up table of `{ cost, maxUses }` where `maxUses: 0` means not offered (default 1 each). Default costs: 2 each, letter count 1, ask the room 3, extra joker 4, or 3 when `showRoundOverview` is off. That default follows the overview until the moderator edits it. Editable until `START_QUIZ`, like every other setting. The form gets a Power-ups section, shown as its own tab in the start dialog.
- **Ledger, not a balance:** store only **purchases** (team, session, power-up, question or round, plus the stored effect: the removed options, the pinned item, the ask-the-room split) and **coin awards** (team, session, coins, optional reason, optional link to the bonus award that created it). The balance is worked out as starting coins (only with power-ups on) + carried coin + coin awards − purchase costs, shown as no less than 0. A reconnect or backend restart just reads it again. A purchase is refused when the balance is too small, the per-session limit is used up, the power-up already ran on this question, or the question can no longer be answered.
- **Question power-ups** can be bought while the question can still be answered: answering and locking included, but not in a kahoot round (a tap locks the pick, so none could help). Never in a showdown. The extra joker is bought for a round but is not offered for a kahoot round either. A power-up already used never changes or resubmits the answer and is never refunded.
- **50/50:** leaves ⌊n/2⌋ options, at least 2, always including the correct one. Not offered with 2 options. The removed options are drawn once and stored.
- **First letter / letter count:** the answer key's literal first letter, or the key with letters as blanks and spaces and punctuation kept.
- **Pin one:** one random item or pair, stored, locked on the phone.
- **Wider margin:** doubles the margin's value in its unit, or `DEFAULT_MARGIN` when there is none. Grading for that team uses the widened margin, at submit time and when a key fix re-scores.
- **Ask the room:** multiple choice only. It needs ≥3 *other* teams with a current answer. It stores the percentage split at the moment of purchase. No team count, no right/wrong, no names. Options removed by this team's 50/50 are shown crossed out with their share.
- **Extra joker:** doubles the next round whose intro hasn't been on air. Refused for a round already doubled (the joker round, or one already extra-jokered). It works with Jokers off. Scoring doubles answer points the same way the joker round does; bonus awards never double.
- **Coin awards:** a shot or selfie bonus award with positive points in a session with power-ups on creates a linked +2 coin award. Deleting the bonus award deletes its coin award. Editing the points doesn't touch it. Manual coin awards (any integer, positive or negative, a take never more than the team has) are entered in the bonus award form but stored and listed separately. They're hidden when power-ups are off.
- **Carried coins:** 2 coins if the team rated every round (break or final form) of its last ended session that shares a league with this session. It's decided at `START_QUIZ`, or at the team's join if later, and stored. A session in no league gives none. With power-ups off, the shop shows only for teams with coins and uses the session's power-up table.
- **Team merge:** unchanged. Teams that played the same session can't be merged, and the carried coin is worked out from the merged history.
- **Power-up count:** per question, per power-up, shown in the big screen's reveal view when non-zero.

## Testing Decisions

- Pure rules in shared types with Vitest/Stryker: the 50/50 leave count, letter-count masking, margin widening, the balance formula, the purchase eligibility rule.
- Backend purchase, coin award and carried-coin flows: real-Postgres Jest specs, checked through the team link and the admin view.
- Frontend: Vitest per power-up control and the settings tab.

## Out of Scope

- Ask the room on Number questions (median)
- Power-up counts in the night brief or stats
- Shield and safety net power-ups
- Automatic refunds after an answer-key fix (accepted tradeoff: the quiz master gives the coin back with a coin award)
