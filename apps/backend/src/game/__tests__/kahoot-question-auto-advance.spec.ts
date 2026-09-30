import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GameStatus,
  type SessionSettings,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 1;
const TIMER_WAIT_MS = 10_000;
const QUIET_PERIOD_MS = 2_500;
const POLL_INTERVAL_MS = 25;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GameGateway — kahoot question auto-advance timer', () => {
  const harness = setupRealStoreGatewayTest();

  /** Opens the first kahoot question (question_open q0, timer armed if configured) with nothing emitted yet. */
  async function openKahootQuestion(
    settings: Partial<SessionSettings>,
  ): Promise<RealStoreGateway> {
    const game = await harness.createGateway({ kahootMode: true, settings });
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0
    game.clearEmits();
    return game;
  }

  function displayStatuses(game: RealStoreGateway): GameStatus[] {
    return game
      .payloadsTo<StateSnapshotPayload>(
        SOCKET_ROOMS.DISPLAY,
        SOCKET_EVENTS.STATE_UPDATED,
      )
      .map((snapshot) => snapshot.progress.status);
  }

  async function waitForDisplayStatus(
    game: RealStoreGateway,
    status: GameStatus,
  ): Promise<void> {
    const deadline = Date.now() + TIMER_WAIT_MS;
    while (!displayStatuses(game).includes(status)) {
      if (Date.now() > deadline) {
        throw new Error(`Display never received a "${status}" snapshot`);
      }
      await delay(POLL_INTERVAL_MS);
    }
  }

  it(
    'auto-advances question_open to locking with no admin action once the timer elapses',
    async () => {
      const game = await openKahootQuestion({
        kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
      });

      await waitForDisplayStatus(game, 'locking');

      expect(displayStatuses(game)).toEqual(['locking']);
    },
    2 * TIMER_WAIT_MS,
  );

  it('does not arm a timer when kahootQuestionTimerSeconds is null', async () => {
    const game = await openKahootQuestion({ kahootQuestionTimerSeconds: null });

    await delay(QUIET_PERIOD_MS);

    expect(game.roomEmits()).toEqual([]);
  });

  it('cancels the pending auto-advance when the admin acts manually before it fires', async () => {
    const game = await openKahootQuestion({
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    });

    await game.act('ADVANCE'); // manual advance -> locking
    game.clearEmits();
    await delay(QUIET_PERIOD_MS);

    expect(game.roomEmits()).toEqual([]);
  });

  it(
    'arms the existing lock timer normally after auto-advancing into locking',
    async () => {
      const game = await openKahootQuestion({
        kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
        lockGraceSeconds: KAHOOT_TIMER_SECONDS,
      });

      await waitForDisplayStatus(game, 'locking'); // auto-advance -> locking
      await waitForDisplayStatus(game, 'reveal'); // lock timer -> reveal

      expect(displayStatuses(game)).toEqual(['locking', 'reveal']);
    },
    2 * TIMER_WAIT_MS,
  );
});
