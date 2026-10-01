import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 30;
const ELAPSED_MS = 5_000;
const FROZEN_NOW = '2024-01-01T00:00:00.000Z';

describe('GameGateway — kahoot question timer deadline', () => {
  const harness = setupRealStoreGatewayTest();

  // Only Date is frozen (timers stay real), so the 30s deadline never fires
  // during a test and Date.now() is a fixed point to compute it against.
  beforeEach(() => {
    freezeClockAt(FROZEN_NOW);
  });

  afterEach(() => {
    restoreClock();
  });

  function timedKahoot(options: CreateGatewayOptions = {}) {
    return harness.createGateway({
      kahootMode: true,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
      ...options,
    });
  }

  async function openFirstQuestion(game: RealStoreGateway) {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    return game.act('ADVANCE'); // -> question_open q0
  }

  it('has no deadline in the lobby', async () => {
    const game = await timedKahoot();

    expect((await game.snapshot()).kahootQuestionEndsAt).toBeNull();
  });

  it('has no deadline on a non-kahoot round question_open', async () => {
    const game = await timedKahoot({ kahootMode: false });

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    expect(opened.kahootQuestionEndsAt).toBeNull();
  });

  it('has no deadline when kahootQuestionTimerSeconds is null (default settings)', async () => {
    const game = await timedKahoot({
      settings: { kahootQuestionTimerSeconds: null },
    });

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    expect(opened.kahootQuestionEndsAt).toBeNull();
  });

  it('arms the deadline at phaseStartedAt + timerSeconds*1000 once a kahoot question opens', async () => {
    const game = await timedKahoot();

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    const expected = Date.now() + KAHOOT_TIMER_SECONDS * 1000;
    expect(opened.kahootQuestionEndsAt).toBe(expected);
    expect((await game.snapshot()).kahootQuestionEndsAt).toBe(expected);
  });

  it('clears the deadline on ADVANCE into locking', async () => {
    const game = await timedKahoot();
    await openFirstQuestion(game);

    const locking = await game.act('ADVANCE'); // -> locking q0

    expect(locking.progress.status).toBe('locking');
    expect(locking.kahootQuestionEndsAt).toBeNull();
    expect((await game.snapshot()).kahootQuestionEndsAt).toBeNull();
  });

  it('does not re-arm a deadline when PREVIOUS reopens an older, non-frontier kahoot question', async () => {
    const game = await timedKahoot();
    await openFirstQuestion(game); // q0 (live)
    await game.act('ADVANCE'); // -> locking q0
    await game.act('ADVANCE'); // -> reveal q0
    await game.act('ADVANCE'); // -> question_open q1 (now live), behind the board
    await game.act('ADVANCE'); // hides the board

    await game.act('PREVIOUS'); // -> reveal q0
    await game.act('PREVIOUS'); // -> locking q0
    const reopened = await game.act('PREVIOUS'); // -> question_open q0 (historical)

    expect(reopened.progress.status).toBe('question_open');
    expect(reopened.progress.questionIndex).toBe(0);
    expect(reopened.kahootQuestionEndsAt).toBeNull();
    expect((await game.snapshot()).kahootQuestionEndsAt).toBeNull();
  });

  it('re-arms the deadline against the persisted phaseStartedAt on restart, not a fresh Date.now()', async () => {
    const game = await timedKahoot();
    const opened = await openFirstQuestion(game);
    advanceClockBy(ELAPSED_MS);

    const restarted = await game.restart();

    expect((await restarted.snapshot()).kahootQuestionEndsAt).toBe(
      opened.kahootQuestionEndsAt,
    );
    expect(opened.kahootQuestionEndsAt).toBe(
      Date.now() - ELAPSED_MS + KAHOOT_TIMER_SECONDS * 1000,
    );
  });
});
