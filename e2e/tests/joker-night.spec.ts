import { test as base, expect } from '../fixtures';
import { E2E_LOCK_GRACE_SECONDS } from '../support/env';
import {
  expectControlJoker,
  expectDisplayStamp,
  expectJokerBorder,
  expectJokerLineNames,
  expectPhoneStamp,
  expectPickedCount,
  expectStampedStandingsRow,
  JOKER_NIGHT,
  pickJokerRound,
  readJokerRound,
  seedJokerSession,
} from '../support/joker-night';
import { snap } from '../support/snapshots';

const { warmUp, music } = JOKER_NIGHT;

// Team A bets on Warm-up and answers both questions of the first block right.
const TEAM_A_JOKER = warmUp;
const TEAM_A_TOTAL = warmUp.points * 2 + music.points;
// Team B never picks, never answers, and so scores nothing whichever round is drawn.
const TEAM_B_TOTAL = 0;

const test = base.extend({
  session: async ({ adminApi }, use) => {
    const quizTitle = `Joker night ${Date.now().toString(36)}`;
    await use(
      await seedJokerSession(adminApi, quizTitle, E2E_LOCK_GRACE_SECONDS),
    );
  },
});

test('a joker night: one team picks, one is drawn, and the 2× stamp lands on the leaderboard with the doubled total', async ({
  control,
  display,
  joinPhone,
}) => {
  const phoneA = await joinPhone('Team A');
  const phoneB = await joinPhone('Team B');
  await control.expectTeams([phoneA.teamName, phoneB.teamName]);
  await control.startQuiz();
  await control.advance('round_overview');

  // 1. The joker pick: Team A taps a round, Team B lets the minute run on.
  await control.advance('joker_pick');
  await display.expectText('Pick your joker');
  await expectPickedCount(display, 0, 2);
  await pickJokerRound(phoneA, music.number);
  await pickJokerRound(phoneA, TEAM_A_JOKER.number);
  await expectPickedCount(display, 1, 2);
  await expect(
    display.page.getByRole('list', { name: 'Teams that picked' }),
  ).toContainText(phoneA.teamName);
  await expectControlJoker(
    control,
    phoneA.teamName,
    /🃏 Round 1 — Warm-up \(picked\)/,
  );
  await snap(display, 'joker_pick');
  await snap(phoneA, 'joker_pick');
  await snap(control, 'joker_pick');

  // 2. The quiz master closes the pick early; Team B gets a round drawn.
  await control.advance('round_intro');
  await expect(phoneA.page.getByText('2× POINTS')).toBeVisible();
  await expectControlJoker(
    control,
    phoneB.teamName,
    /🃏 Round \d+ — .+ \(drawn\)/,
  );
  const teamBJokerRound = await readJokerRound(phoneB);
  expect(await readJokerRound(phoneA)).toBe(TEAM_A_JOKER.number);
  await expectJokerLineNames(phoneA, TEAM_A_JOKER.number, TEAM_A_JOKER.title);
  const isTeamBStamped = JOKER_NIGHT.firstBlockRounds.some(
    (roundNumber) => roundNumber === teamBJokerRound,
  );

  // 3. The joker round's question wears the border, the other round's does not.
  await control.advance('question_open');
  await phoneA.expectQuestion(warmUp.prompt);
  await expectJokerBorder(phoneA, true);
  await expectJokerBorder(phoneB, teamBJokerRound === warmUp.number);
  await phoneA.submitText(warmUp.key);

  await control.advance('round_intro');
  await control.advance('question_open');
  await phoneA.expectQuestion(music.prompt);
  await expectJokerBorder(phoneA, false);
  await expectJokerBorder(phoneB, teamBJokerRound === music.number);
  await phoneA.submitText(music.key);

  // 4. Locked in the break, the joker question still wears it.
  await control.advance('locking');
  await control.expectStatus('break_intro');
  await phoneA.openQuestion(warmUp.number, 1);
  await phoneA.expectAnswersLocked();
  await expectJokerBorder(phoneA, true);

  // 5. The block is revealed, then the leaderboard covers the next round's card.
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await expectJokerBorder(phoneA, true);
  await control.advance('reveal_intro');
  await control.advance('reveal');
  await expectJokerBorder(phoneA, false);
  await control.advance('round_intro');

  // 6. The stamp lands as each rank is revealed, with the doubled total.
  await control.revealNextLeaderboardTeam();
  await expectStampedStandingsRow(
    display,
    phoneB.teamName,
    TEAM_B_TOTAL,
    isTeamBStamped,
  );
  await expectDisplayStamp(display, phoneB.teamName, isTeamBStamped);
  await phoneB.expectOwnStanding(TEAM_B_TOTAL);
  await expectPhoneStamp(phoneB, isTeamBStamped);

  await control.revealNextLeaderboardTeam();
  await expectStampedStandingsRow(display, phoneA.teamName, TEAM_A_TOTAL, true);
  await expectDisplayStamp(display, phoneA.teamName, true);
  await phoneA.expectOwnStanding(TEAM_A_TOTAL);
  await expectPhoneStamp(phoneA, true);
});
