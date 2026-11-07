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

const QUICKFIRE_TIMER_SECONDS = 20;

describe('GameGateway — quickfire question auto-advance timer', () => {
  const harness = setupRealStoreGatewayTest();

  /** Opens the first quickfire question (question_open q0, timer armed if configured) with nothing emitted yet. */
  async function openQuickfireQuestion(
    settings: Partial<SessionSettings>,
  ): Promise<RealStoreGateway> {
    const game = await harness.createGateway({ quickfire: true, settings });
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
    const game = await openQuickfireQuestion({
      quickfireQuestionTimerSeconds: QUICKFIRE_TIMER_SECONDS,
    });

    await game.timers().quickfire.fireNow();

    expect(displayStatuses(game)).toEqual(['locking']);
  });

  it('does not arm a timer when quickfireQuestionTimerSeconds is null', async () => {
    const game = await openQuickfireQuestion({
      quickfireQuestionTimerSeconds: null,
    });

    expect(game.timers().quickfire.isArmed()).toBe(false);
    expect(game.timers().quickfire.dueAt()).toBeNull();
  });

  it('cancels the pending auto-advance when the admin acts manually before it fires', async () => {
    const game = await openQuickfireQuestion({
      quickfireQuestionTimerSeconds: QUICKFIRE_TIMER_SECONDS,
    });

    await game.act('ADVANCE'); // manual advance -> locking

    expect(game.timers().quickfire.isArmed()).toBe(false);
  });

  it('arms the existing lock timer normally after auto-advancing into locking', async () => {
    const game = await openQuickfireQuestion({
      quickfireQuestionTimerSeconds: QUICKFIRE_TIMER_SECONDS,
    });

    await game.timers().quickfire.fireNow(); // auto-advance -> locking
    expect(game.timers().lock.isArmed()).toBe(true);
    await game.timers().lock.fireNow(); // lock timer -> reveal

    expect(displayStatuses(game)).toEqual(['locking', 'reveal']);
  });

  it('still auto-locks on the original deadline after a restart mid-question', async () => {
    const game = await openQuickfireQuestion({
      quickfireQuestionTimerSeconds: QUICKFIRE_TIMER_SECONDS,
    });
    const deadline = (await game.resync('display'))
      .quickfireQuestionEndsAt as number;

    const restarted = await game.restart();
    restarted.clearEmits();

    expect((await restarted.resync('display')).quickfireQuestionEndsAt).toBe(
      deadline,
    );
    expect(restarted.timers().quickfire.dueAt()).toBe(deadline);
    await restarted.timers().quickfire.fireNow();
    expect(displayStatuses(restarted)).toEqual(['locking']);
  });
});
