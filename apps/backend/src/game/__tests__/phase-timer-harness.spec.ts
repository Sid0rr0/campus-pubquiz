import {
  setupRealStoreGatewayTest,
  type PhaseTimerControl,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

describe('real-store harness — phase timer controls', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;
  let armedAtTestEnd: PhaseTimerControl[];

  beforeEach(async () => {
    game = await harness.createGateway({
      kahootMode: true,
      settings: { kahootQuestionTimerSeconds: 20 },
    });
  });

  it('arms the kahoot question timer for a kahoot question and the lock timer for its locking phase', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open, kahoot timer armed
    const { kahoot, lock } = game.timers();
    expect(kahoot.isArmed()).toBe(true);
    expect(lock.isArmed()).toBe(false);
    expect(kahoot.dueAt()).toBe(
      (await game.resync('display')).kahootQuestionEndsAt,
    );

    await kahoot.fireNow();

    expect(kahoot.isArmed()).toBe(false);
    expect(lock.isArmed()).toBe(true);
  });

  it('throws when firing a timer that is not armed', async () => {
    await expect(game.timers().lock.fireNow()).rejects.toThrow(
      'No timer is armed',
    );
  });

  // The two tests below prove a timer armed in one test never outlives it:
  // the first leaves one armed, afterAll (which runs after the harness's
  // per-test cleanup) checks it is gone.
  it('leaves a timer armed when the test ends', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE');
    await game.act('ADVANCE');
    armedAtTestEnd = [game.timers().kahoot];
    expect(armedAtTestEnd[0].isArmed()).toBe(true);
  });

  afterAll(() => {
    expect(armedAtTestEnd.map((timer) => timer.isArmed())).toEqual([false]);
  });
});
