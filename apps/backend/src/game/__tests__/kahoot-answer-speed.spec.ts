import type { MockSocket } from '@/game/__tests__/test-utils';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
} from '@/game/__tests__/real-store-test-utils';

describe('GameGateway — submit answer in a kahoot round', () => {
  const harness = setupRealStoreGatewayTest();

  const KAHOOT_TIMER_SECONDS = 10;
  const FAST_MS = 1_000;
  const SLOW_MS = 8_000;

  beforeEach(() => {
    freezeClockAt('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    restoreClock();
  });

  it('scores a faster correct answer higher than a slower one', async () => {
    const kahoot = await harness.createGateway({
      teamNames: ['Fast', 'Slow'],
      rounds: [
        {
          title: 'Speed Round',
          kahootMode: true,
          questions: [
            {
              type: 'multiple_choice',
              prompt: 'Capital of France?',
              answer: 'Paris',
              points: 10,
              payload: { options: ['Paris', 'London'] },
            },
          ],
        },
      ],
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    const kahootAdmin = await kahoot.connectAdmin();
    const [fast, slow] = kahoot.teams;
    const [questionId] = kahoot.rounds[0].questionIds;
    const answer = (teamSocket: MockSocket, teamId: number) =>
      kahoot.gateway.handleSubmitAnswer(asSocket(teamSocket), {
        questionId,
        teamId,
        value: 'Paris',
      });
    await kahoot.openFirstQuestion(kahootAdmin);

    advanceClockBy(FAST_MS);
    await answer(fast.socket, fast.teamId);
    advanceClockBy(SLOW_MS - FAST_MS);
    await answer(slow.socket, slow.teamId);
    await kahoot.act('ADVANCE'); // -> locking
    await kahoot.act('ADVANCE'); // -> reveal (speed-scored)

    const stored = await kahoot.inRequestContext(() =>
      kahoot.answerService.listForQuestion(kahoot.gameSessionId, questionId),
    );
    const points = Object.fromEntries(
      stored.map((row) => [row.teamName, row.pointsAwarded ?? 0]),
    );
    expect(points.Fast).toBeGreaterThan(points.Slow);
    expect(points.Slow).toBeGreaterThan(0);
  });
});
