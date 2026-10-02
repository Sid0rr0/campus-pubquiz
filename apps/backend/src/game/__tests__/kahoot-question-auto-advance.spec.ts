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

const KAHOOT_TIMER_SECONDS = 20;

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

  it('auto-advances question_open to locking with no admin action once the timer elapses', async () => {
    const game = await openKahootQuestion({
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    });

    await game.timers().kahoot.fireNow();

    expect(displayStatuses(game)).toEqual(['locking']);
  });

  it('does not arm a timer when kahootQuestionTimerSeconds is null', async () => {
    const game = await openKahootQuestion({ kahootQuestionTimerSeconds: null });

    expect(game.timers().kahoot.isArmed()).toBe(false);
    expect(game.timers().kahoot.dueAt()).toBeNull();
  });

  it('cancels the pending auto-advance when the admin acts manually before it fires', async () => {
    const game = await openKahootQuestion({
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    });

    await game.act('ADVANCE'); // manual advance -> locking

    expect(game.timers().kahoot.isArmed()).toBe(false);
  });

  it('arms the existing lock timer normally after auto-advancing into locking', async () => {
    const game = await openKahootQuestion({
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    });

    await game.timers().kahoot.fireNow(); // auto-advance -> locking
    expect(game.timers().lock.isArmed()).toBe(true);
    await game.timers().lock.fireNow(); // lock timer -> reveal

    expect(displayStatuses(game)).toEqual(['locking', 'reveal']);
  });

  it('still auto-locks on the original deadline after a restart mid-question', async () => {
    const game = await openKahootQuestion({
      kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS,
    });
    const deadline = (await game.snapshot()).kahootQuestionEndsAt as number;

    const restarted = await game.restart();
    restarted.clearEmits();

    expect((await restarted.snapshot()).kahootQuestionEndsAt).toBe(deadline);
    expect(restarted.timers().kahoot.dueAt()).toBe(deadline);
    await restarted.timers().kahoot.fireNow();
    expect(displayStatuses(restarted)).toEqual(['locking']);
  });
});
