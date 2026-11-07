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
      quickfire: true,
      settings: { quickfireQuestionTimerSeconds: 20 },
    });
  });

  it('arms the quickfire question timer for a quickfire question and the lock timer for its locking phase', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open, quickfire timer armed
    const { quickfire, lock } = game.timers();
    expect(quickfire.isArmed()).toBe(true);
    expect(lock.isArmed()).toBe(false);
    expect(quickfire.dueAt()).toBe(
      (await game.resync('display')).quickfireQuestionEndsAt,
    );

    await quickfire.fireNow();

    expect(quickfire.isArmed()).toBe(false);
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
    armedAtTestEnd = [game.timers().quickfire];
    expect(armedAtTestEnd[0].isArmed()).toBe(true);
  });

  afterAll(() => {
    expect(armedAtTestEnd.map((timer) => timer.isArmed())).toEqual([false]);
  });
});
