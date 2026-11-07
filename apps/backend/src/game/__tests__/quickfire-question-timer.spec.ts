import { SOCKET_ROOMS } from '@campus-pubquiz/types';
import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const QUICKFIRE_TIMER_SECONDS = 30;
const ELAPSED_MS = 5_000;
const FROZEN_NOW = '2024-01-01T00:00:00.000Z';

describe('GameGateway — quickfire question timer deadline', () => {
  const harness = setupRealStoreGatewayTest();

  // Only Date is frozen (timers stay real), so the 30s deadline never fires
  // during a test and Date.now() is a fixed point to compute it against.
  beforeEach(() => {
    freezeClockAt(FROZEN_NOW);
  });

  afterEach(() => {
    restoreClock();
  });

  /** What the big screen is sent — the room that carries the quickfire deadline. */
  function displayView(game: RealStoreGateway) {
    return game.gameState.getView(game.joinCode, SOCKET_ROOMS.DISPLAY);
  }

  function timedQuickfire(options: CreateGatewayOptions = {}) {
    return harness.createGateway({
      quickfire: true,
      settings: { quickfireQuestionTimerSeconds: QUICKFIRE_TIMER_SECONDS },
      ...options,
    });
  }

  async function openFirstQuestion(game: RealStoreGateway) {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
    return displayView(game);
  }

  it('has no deadline in the lobby', async () => {
    const game = await timedQuickfire();

    expect((await game.resync('display')).quickfireQuestionEndsAt).toBeNull();
  });

  it('has no deadline on a non-quickfire round question_open', async () => {
    const game = await timedQuickfire({ quickfire: false });

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    expect(opened.quickfireQuestionEndsAt).toBeNull();
  });

  it('has no deadline when quickfireQuestionTimerSeconds is null (default settings)', async () => {
    const game = await timedQuickfire({
      settings: { quickfireQuestionTimerSeconds: null },
    });

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    expect(opened.quickfireQuestionEndsAt).toBeNull();
  });

  it('arms the deadline at phaseStartedAt + timerSeconds*1000 once a quickfire question opens', async () => {
    const game = await timedQuickfire();

    const opened = await openFirstQuestion(game);

    expect(opened.progress.status).toBe('question_open');
    const expected = Date.now() + QUICKFIRE_TIMER_SECONDS * 1000;
    expect(opened.quickfireQuestionEndsAt).toBe(expected);
    expect((await game.resync('display')).quickfireQuestionEndsAt).toBe(
      expected,
    );
  });

  it('clears the deadline on ADVANCE into locking', async () => {
    const game = await timedQuickfire();
    await openFirstQuestion(game);

    const locking = await game.act('ADVANCE'); // -> locking q0

    expect(locking.progress.status).toBe('locking');
    expect((await game.resync('display')).quickfireQuestionEndsAt).toBeNull();
  });

  it('does not re-arm a deadline when PREVIOUS reopens an older, non-frontier quickfire question', async () => {
    const game = await timedQuickfire();
    await openFirstQuestion(game); // q0 (live)
    await game.act('ADVANCE'); // -> locking q0
    await game.act('ADVANCE'); // -> reveal q0
    await game.act('ADVANCE'); // -> question_open q1 (now live), behind the board
    await game.act('ADVANCE'); // hides the board

    await game.act('PREVIOUS'); // -> reveal q0
    await game.act('PREVIOUS'); // -> locking q0
    await game.act('PREVIOUS'); // -> question_open q0 (historical)
    const reopened = displayView(game);

    expect(reopened.progress.status).toBe('question_open');
    expect(reopened.progress.questionIndex).toBe(0);
    expect(reopened.quickfireQuestionEndsAt).toBeNull();
    expect((await game.resync('display')).quickfireQuestionEndsAt).toBeNull();
  });

  it('re-arms the deadline against the persisted phaseStartedAt on restart, not a fresh Date.now()', async () => {
    const game = await timedQuickfire();
    const opened = await openFirstQuestion(game);
    advanceClockBy(ELAPSED_MS);

    const restarted = await game.restart();

    expect((await restarted.resync('display')).quickfireQuestionEndsAt).toBe(
      opened.quickfireQuestionEndsAt,
    );
    expect(opened.quickfireQuestionEndsAt).toBe(
      Date.now() - ELAPSED_MS + QUICKFIRE_TIMER_SECONDS * 1000,
    );
  });
});
