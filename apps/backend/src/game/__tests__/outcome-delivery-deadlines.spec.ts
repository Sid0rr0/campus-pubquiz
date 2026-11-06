import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';

const TIMER_SECONDS = 60;
const LOCK_AT = 4_000_000_000_000;
const QUICKFIRE_AT = 4_000_000_500_000;

describe('GameGateway — outcome delivery re-arms the phase timers', () => {
  const harness = setupRealStoreGatewayTest();

  async function openQuickfireQuestion() {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      joinCode: 'DEADLINE1',
      quickfire: true,
      settings: {
        quickfireQuestionTimerSeconds: TIMER_SECONDS,
        lockGraceSeconds: TIMER_SECONDS,
      },
    });
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    return game;
  }

  it('arms the timers to the deadlines an outcome carries', async () => {
    const game = await openQuickfireQuestion();

    await game.broadcaster.deliver(game.joinCode, {
      ...BROADCAST_STATE_OUTCOME,
      deadlineChange: {
        questionLockAt: LOCK_AT,
        quickfireQuestionEndsAt: null,
        jokerPickEndsAt: null,
      },
    });

    expect(game.timers().lock.dueAt()).toBe(LOCK_AT);
    expect(game.timers().quickfire.isArmed()).toBe(false);
  });

  it('leaves the armed timers alone for an outcome without a deadline change', async () => {
    const game = await openQuickfireQuestion();
    const dueAt = game.timers().quickfire.dueAt();
    expect(dueAt).not.toBeNull();

    await game.broadcaster.deliver(game.joinCode, BROADCAST_STATE_OUTCOME);

    expect(game.timers().quickfire.dueAt()).toBe(dueAt);
    expect(game.timers().lock.isArmed()).toBe(false);
  });

  it('re-arms before any emit, so a failed emit cannot leave the timers stale', async () => {
    const game = await openQuickfireQuestion();
    game.server.emit.mockImplementation(() => {
      throw new Error('socket hiccup');
    });

    await expect(
      game.broadcaster.deliver(game.joinCode, {
        ...BROADCAST_STATE_OUTCOME,
        deadlineChange: {
          questionLockAt: null,
          quickfireQuestionEndsAt: QUICKFIRE_AT,
          jokerPickEndsAt: null,
        },
      }),
    ).rejects.toThrow('socket hiccup');

    expect(game.timers().quickfire.dueAt()).toBe(QUICKFIRE_AT);
    game.server.emit.mockReset();
  });
});
