import { test } from '../fixtures';
import {
  awardBonus,
  expectBonusToast,
  expectNoBonusToast,
  expectPodiumEntry,
  expectTeamsTablePoints,
} from '../support/bonus';
import { startWithTwoTeams } from '../support/two-team-quiz';

const BONUS_POINTS = 1;
const SELFIE_TOAST = '🎉 +1 point — Selfie';

test('a bonus award in the break shows a toast on that team only and counts in the standings', async ({
  control,
  display,
  joinPhone,
}) => {
  // 1. Two teams play through the block without answering, so the bonus is their only points.
  const { phoneA, phoneB } = await startWithTwoTeams(control, joinPhone);
  await control.advance('question_open');
  await control.advance('round_intro');
  await control.advance('question_open');
  await control.advance('locking');
  await control.expectStatus('break_intro');

  // 2. In the break the quiz master gives Team A a selfie bonus.
  await awardBonus(control, phoneA.teamName, 'selfie', BONUS_POINTS);

  // 3. Team A's phone shows the toast; Team B's does not.
  await expectBonusToast(phoneA, SELFIE_TOAST);
  await expectNoBonusToast(phoneB, SELFIE_TOAST);

  // 4. The quiz master's table and the big screen's leaderboard include the bonus.
  await expectTeamsTablePoints(control, phoneA.teamName, BONUS_POINTS, 1);
  await expectTeamsTablePoints(control, phoneB.teamName, 0, 0);
  await control.toggleLeaderboard();
  await control.revealNextLeaderboardTeam();
  await expectPodiumEntry(display, phoneB.teamName, 0, 2);
  await control.revealNextLeaderboardTeam();
  await expectPodiumEntry(display, phoneA.teamName, BONUS_POINTS, 1);
  await phoneA.expectOwnStanding(BONUS_POINTS);
});
