import type { GameAction } from '@campus-pubquiz/types';
import {
  TWO_ROUND_QUIZ,
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const START_OF_TIME = '2024-01-01T00:00:00.000Z';
const DEFAULT_LOCK_GRACE_MS = 60_000;
const CUSTOM_LOCK_GRACE_SECONDS = 15;

const TO_LAST_QUESTION: GameAction[] = [
  'START_QUIZ',
  'ADVANCE', // -> round_intro(0)
  'ADVANCE', // -> r1q1
  'ADVANCE', // -> r1q2
  'ADVANCE', // -> round_intro(1)
  'ADVANCE', // -> r2q1
  'ADVANCE', // -> r2q2 (last, breakAfter, still open)
];
const TO_LOCKING: GameAction[] = [...TO_LAST_QUESTION, 'ADVANCE']; // lock armed

describe('GameGateway — question lock countdown', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  async function actAll(actions: GameAction[], from = game) {
    let snapshot = await from.snapshot();
    for (const action of actions) {
      snapshot = await from.act(action);
    }
    return snapshot;
  }

  beforeEach(async () => {
    game = await harness.createGateway({ rounds: TWO_ROUND_QUIZ });
    freezeClockAt(START_OF_TIME);
  });

  afterEach(() => {
    restoreClock();
  });

  it('has no lock armed in the lobby', async () => {
    expect((await game.snapshot()).questionLockAt).toBeNull();
  });

  it('does not arm a lock on the last question of a round with breakAfter: false', async () => {
    const snapshot = await actAll([
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> r1q1
      'ADVANCE', // -> r1q2 (last of round 1, breakAfter: false)
    ]);
    expect(snapshot.questionLockAt).toBeNull();
  });

  it('does not arm a lock on the first question of a breakAfter round', async () => {
    const snapshot = await actAll(TO_LAST_QUESTION.slice(0, -1)); // -> r2q1
    expect(snapshot.questionLockAt).toBeNull();
  });

  it('does not arm a lock while merely sitting on the last question of a breakAfter round', async () => {
    const snapshot = await actAll(TO_LAST_QUESTION);

    expect(snapshot.progress.status).toBe('question_open');
    expect(snapshot.questionLockAt).toBeNull();
    expect((await game.snapshot()).questionLockAt).toBeNull();
  });

  it('arms a 60s lock deadline once the admin advances into the locking countdown', async () => {
    const locking = await actAll(TO_LOCKING);

    expect(locking.progress.status).toBe('locking');
    expect(locking.questionLockAt).toBe(Date.now() + DEFAULT_LOCK_GRACE_MS);
    expect((await game.snapshot()).questionLockAt).toBe(
      Date.now() + DEFAULT_LOCK_GRACE_MS,
    );
  });

  it('clears the lock when the admin steps back from locking to the last question', async () => {
    await actAll(TO_LOCKING);

    const back = await game.act('PREVIOUS'); // -> question_open again

    expect(back.progress.status).toBe('question_open');
    expect(back.questionLockAt).toBeNull();
    expect((await game.snapshot()).questionLockAt).toBeNull();
  });

  it('clears the lock once the countdown advances into break', async () => {
    await actAll(TO_LOCKING);

    const breakSnapshot = await game.act('ADVANCE'); // -> break_intro

    expect(breakSnapshot.progress.status).toBe('break_intro');
    expect(breakSnapshot.questionLockAt).toBeNull();
    expect((await game.snapshot()).questionLockAt).toBeNull();
  });

  it('clears the lock when a new quiz is selected', async () => {
    await actAll(TO_LOCKING);
    await game.act('END_QUIZ');

    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    expect(created.questionLockAt).toBeNull();
  });

  it('re-arms a fresh lock deadline on rehydrate if restarted mid-countdown', async () => {
    await actAll(TO_LOCKING);
    advanceClockBy(10_000); // downtime before the backend comes back

    const restarted = await game.restart();

    expect((await restarted.snapshot()).questionLockAt).toBe(
      Date.now() + DEFAULT_LOCK_GRACE_MS,
    );
  });

  it('arms the lock deadline using the session-specific lockGraceSeconds instead of the 60s default', async () => {
    restoreClock();
    const custom = await harness.createGateway({
      joinCode: 'CUSTOM',
      rounds: TWO_ROUND_QUIZ,
      settings: { lockGraceSeconds: CUSTOM_LOCK_GRACE_SECONDS },
    });
    freezeClockAt(START_OF_TIME);

    const locking = await actAll(TO_LOCKING, custom);

    expect(locking.progress.status).toBe('locking');
    expect(locking.questionLockAt).toBe(
      Date.now() + CUSTOM_LOCK_GRACE_SECONDS * 1_000,
    );
  });
});
