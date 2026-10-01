import { asSocket } from '@/game/__tests__/test-utils';
import {
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const START_OF_TIME = '2024-01-01T00:00:00.000Z';
const KAHOOT_TIMER_SECONDS = 30;
const BREAK_END_TIME = Date.parse('2024-01-01T01:00:00.000Z');

describe('GameGateway — a freshly created session', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      kahootMode: true,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    freezeClockAt(START_OF_TIME);
  });

  afterEach(() => {
    restoreClock();
  });

  async function dirtyThenEndTheSession() {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0, kahoot deadline armed
    const admin = await game.connectAdmin();
    await game.gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: BREAK_END_TIME,
    });
    await game.act('END_QUIZ');
  }

  it('starts in the lobby with no deadlines, no break end time and nothing revealed', async () => {
    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    const snapshot = await game.snapshot(created.joinCode);
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.questionLockAt).toBeNull();
    expect(snapshot.kahootQuestionEndsAt).toBeNull();
    expect(snapshot.breakEndsAt).toBeNull();
    expect(snapshot.leaderboardRevealCount).toBe(0);
    expect(snapshot.closestGuessRevealStep).toBe(0);
  });

  it('carries nothing over from the session that came before it', async () => {
    await dirtyThenEndTheSession();

    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    const snapshot = await game.snapshot(created.joinCode);
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.kahootQuestionEndsAt).toBeNull();
    expect(snapshot.breakEndsAt).toBeNull();
    expect(snapshot.leaderboardRevealCount).toBe(0);
    expect(snapshot.closestGuessRevealStep).toBe(0);
    expect(snapshot.phaseStartedAt).toBeNull();
    expect(snapshot.phaseElapsedMs).toBeNull();
  });
});
