import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GameAction,
  type SocketRoomName,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const RESTART_DEADLINE_TOLERANCE_MS = 1_000;

describe('GameGateway — question lock auto-advance timer', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    // One breakAfter round of two questions.
    game = await harness.createGateway({
      rounds: [
        {
          title: 'Round A',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'QA1', answer: 'A1' },
            { type: 'free_text', prompt: 'QA2', answer: 'A2' },
          ],
        },
      ],
    });
  });

  async function actAll(actions: GameAction[]): Promise<void> {
    for (const action of actions) {
      await game.act(action);
    }
  }

  /** Opens the last question of the single breakAfter round (no lock yet — still just open). */
  async function openLastQuestion(): Promise<void> {
    await actAll([
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> qA1
      'ADVANCE', // -> qA2 (last question, breakAfter, still just open)
    ]);
    game.clearEmits();
  }

  /** Opens the last question, then advances into the locking countdown (lock gets armed). */
  async function enterLockingCountdown(): Promise<void> {
    await openLastQuestion();
    await game.act('ADVANCE'); // -> locking, lock armed
    game.clearEmits();
  }

  function expectBreakIntroDelivered(
    target: RealStoreGateway = game,
    rooms: SocketRoomName[] = [SOCKET_ROOMS.DISPLAY],
  ): void {
    for (const room of rooms) {
      expect(
        target
          .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
          .map(({ progress }) => progress.status),
      ).toContain('break_intro');
    }
  }

  it('does not arm a lock merely from opening the last question of a breakAfter round', async () => {
    await openLastQuestion();

    expect(game.timers().lock.isArmed()).toBe(false);
  });

  it('auto-advances to break once the grace passes after the admin starts the locking countdown, without further admin action', async () => {
    await enterLockingCountdown();

    await game.timers().lock.fireNow();

    expectBreakIntroDelivered(game, [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]);
  });

  it('still auto-advances to break after a backend restart mid-countdown', async () => {
    await enterLockingCountdown();
    const dueAt = game.timers().lock.dueAt();

    const restarted = await game.restart();
    restarted.clearEmits();

    // Restored from the stored phase start, so equal to the original to within the stored precision — never a fresh grace period from the restart.
    expect(
      Math.abs((restarted.timers().lock.dueAt() ?? 0) - (dueAt ?? 0)),
    ).toBeLessThan(RESTART_DEADLINE_TOLERANCE_MS);
    await restarted.timers().lock.fireNow();
    expectBreakIntroDelivered(restarted);
  });

  it('cancels the pending auto-lock when the admin advances manually before it fires', async () => {
    await enterLockingCountdown();

    await game.act('ADVANCE'); // manual advance -> break

    expect(game.timers().lock.isArmed()).toBe(false);
  });

  it('cancels the pending auto-lock when the admin steps back from locking to the question', async () => {
    await enterLockingCountdown();

    await game.act('PREVIOUS'); // manual step back -> question_open

    expect(game.timers().lock.isArmed()).toBe(false);
  });

  it('does not arm a lock on a question that is not the last of a breakAfter round', async () => {
    await actAll([
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> qA1 (first of two, not last)
    ]);

    expect(game.timers().lock.isArmed()).toBe(false);
  });
});
