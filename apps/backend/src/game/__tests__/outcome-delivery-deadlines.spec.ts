import { setupRealStoreGatewayTest } from '@/game/__tests__/real-store-test-utils';
import { BROADCAST_STATE_OUTCOME } from '@/game/state/session-outcome';

const TIMER_SECONDS = 60;
const LOCK_AT = 4_000_000_000_000;
const KAHOOT_AT = 4_000_000_500_000;

describe('GameGateway — outcome delivery re-arms the auto-lock timers', () => {
  const harness = setupRealStoreGatewayTest();

  async function openKahootQuestion() {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      joinCode: 'DEADLINE1',
      kahootMode: true,
      settings: {
        kahootQuestionTimerSeconds: TIMER_SECONDS,
        lockGraceSeconds: TIMER_SECONDS,
      },
    });
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    return game;
  }

  it('arms both timers to the deadlines an outcome carries', async () => {
    const game = await openKahootQuestion();

    await game.gateway.deliverSessionOutcome(game.joinCode, {
      ...BROADCAST_STATE_OUTCOME,
      deadlineChange: { questionLockAt: LOCK_AT, kahootQuestionEndsAt: null },
    });

    expect(game.timers().lock.dueAt()).toBe(LOCK_AT);
    expect(game.timers().kahoot.isArmed()).toBe(false);
  });

  it('leaves the armed timers alone for an outcome without a deadline change', async () => {
    const game = await openKahootQuestion();
    const dueAt = game.timers().kahoot.dueAt();
    expect(dueAt).not.toBeNull();

    await game.gateway.deliverSessionOutcome(
      game.joinCode,
      BROADCAST_STATE_OUTCOME,
    );

    expect(game.timers().kahoot.dueAt()).toBe(dueAt);
    expect(game.timers().lock.isArmed()).toBe(false);
  });

  it('re-arms before any emit, so a failed emit cannot leave the timers stale', async () => {
    const game = await openKahootQuestion();
    game.server.emit.mockImplementation(() => {
      throw new Error('socket hiccup');
    });

    await expect(
      game.gateway.deliverSessionOutcome(game.joinCode, {
        ...BROADCAST_STATE_OUTCOME,
        deadlineChange: {
          questionLockAt: null,
          kahootQuestionEndsAt: KAHOOT_AT,
        },
      }),
    ).rejects.toThrow('socket hiccup');

    expect(game.timers().kahoot.dueAt()).toBe(KAHOOT_AT);
    game.server.emit.mockReset();
  });
});
