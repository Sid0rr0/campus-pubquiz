import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type GameAction,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const LOCK_GRACE_SECONDS = 1;
const PAST_LOCK_GRACE_MS = 1_800;
const AUTO_ADVANCE_WAIT_MS = 10_000;
const POLL_INTERVAL_MS = 25;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GameGateway — question lock auto-advance timer', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    // One breakAfter round of two questions; the short grace stands in for
    // the 60s default so the timer can fire within a test.
    game = await harness.createGateway({
      settings: { lockGraceSeconds: LOCK_GRACE_SECONDS },
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

  async function expectNothingHappensPastTheGrace(): Promise<void> {
    await delay(PAST_LOCK_GRACE_MS);
    expect(game.roomEmits()).toEqual([]);
  }

  async function waitForBreakIntro(): Promise<void> {
    const deadline = Date.now() + AUTO_ADVANCE_WAIT_MS;
    const hasBreakIntro = () =>
      game
        .payloadsTo<StateSnapshotPayload>(
          SOCKET_ROOMS.DISPLAY,
          SOCKET_EVENTS.STATE_UPDATED,
        )
        .some(({ progress }) => progress.status === 'break_intro');
    while (!hasBreakIntro()) {
      if (Date.now() > deadline) {
        throw new Error('The lock timer never advanced the game to break');
      }
      await delay(POLL_INTERVAL_MS);
    }
  }

  it('does not arm a lock merely from opening the last question of a breakAfter round', async () => {
    await openLastQuestion();

    await expectNothingHappensPastTheGrace();
  });

  it('auto-advances to break once the grace passes after the admin starts the locking countdown, without further admin action', async () => {
    await enterLockingCountdown();

    await waitForBreakIntro();

    for (const room of [
      SOCKET_ROOMS.DISPLAY,
      SOCKET_ROOMS.ADMIN,
      SOCKET_ROOMS.PLAYERS,
    ]) {
      expect(
        game
          .payloadsTo<StateSnapshotPayload>(room, SOCKET_EVENTS.STATE_UPDATED)
          .map(({ progress }) => progress.status),
      ).toContain('break_intro');
    }
  });

  it('cancels the pending auto-lock when the admin advances manually before it fires', async () => {
    await enterLockingCountdown();

    await game.act('ADVANCE'); // manual advance -> break
    game.clearEmits();

    await expectNothingHappensPastTheGrace();
  });

  it('cancels the pending auto-lock when the admin steps back from locking to the question', async () => {
    await enterLockingCountdown();

    await game.act('PREVIOUS'); // manual step back -> question_open
    game.clearEmits();

    await expectNothingHappensPastTheGrace();
  });

  it('does not arm a lock on a question that is not the last of a breakAfter round', async () => {
    await actAll([
      'START_QUIZ',
      'ADVANCE', // -> round_intro(0)
      'ADVANCE', // -> qA1 (first of two, not last)
    ]);
    game.clearEmits();

    await expectNothingHappensPastTheGrace();
  });
});
