import {
  SOCKET_EVENTS,
  type GameStatus,
  type SessionSettings,
} from '@campus-pubquiz/types';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const TIMER_SECONDS = 60;

type Trigger = 'manual' | 'timer';

interface Scenario {
  name: string;
  kahootMode: boolean;
  /** Which timer the "timer" trigger relies on; the other stays out of the way. */
  timer: 'lock' | 'kahootQuestion';
}

const SCENARIOS: Scenario[] = [
  { name: 'lock timer, normal round', kahootMode: false, timer: 'lock' },
  { name: 'lock timer, kahoot round', kahootMode: true, timer: 'lock' },
  { name: 'kahoot question timer', kahootMode: true, timer: 'kahootQuestion' },
];

/** Room emits reduced to what a client can observe, independent of the session's join code and row ids. */
function summarizeEmits(game: RealStoreGateway): string[] {
  return game.roomEmits().map(({ rooms, event, payload }) => {
    const target = rooms
      .map((room) => room.replace(`:${game.joinCode}`, ''))
      .join('+');
    if (event === SOCKET_EVENTS.STATE_UPDATED) {
      const { progress } = payload as { progress: { status: GameStatus } };
      return `${target} ${event} ${progress.status}`;
    }
    if (event === SOCKET_EVENTS.TEAM_ANSWERS_SYNCED) {
      const { answers } = payload as { answers: unknown[] };
      return `${target} ${event} x${answers.length}`;
    }
    return `${target} ${event}`;
  });
}

describe('GameGateway — outcome delivery and timer-driven advance', () => {
  const harness = setupRealStoreGatewayTest();
  let gameCount = 0;

  function nextJoinCode(): string {
    return `TIMER${gameCount++}`;
  }

  async function advanceToLocking(
    game: RealStoreGateway,
    admin: MockSocket,
    isKahoot: boolean,
  ): Promise<void> {
    // A kahoot question locks straight from its first question; a normal
    // round only locks after its last one (multiple_choice, free_text,
    // closest_guess, match, audio).
    const advances = isKahoot ? 1 : 5;
    for (let index = 0; index < advances; index++) {
      await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      });
    }
  }

  /**
   * Plays a question up to the point right before the next automatic
   * transition, then produces that transition either by the admin pressing
   * ADVANCE or by firing the timer. Returns every emit it produced.
   */
  async function runTransition(
    scenario: Scenario,
    trigger: Trigger,
  ): Promise<string[]> {
    const settings: Partial<SessionSettings> = {
      lockGraceSeconds: TIMER_SECONDS,
      kahootQuestionTimerSeconds:
        scenario.timer === 'kahootQuestion' ? TIMER_SECONDS : null,
    };
    const game = await harness.createGateway({
      teamNames: [`Quizzards ${gameCount}`],
      joinCode: nextJoinCode(),
      kahootMode: scenario.kahootMode,
      settings,
    });
    const admin = await game.connectAdmin();
    const [{ socket: team, teamId }] = game.teams;
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.questionIds.multipleChoice,
      teamId,
      value: 'Paris',
    });
    if (scenario.timer === 'lock') {
      await advanceToLocking(game, admin, scenario.kahootMode);
    }
    game.clearEmits();

    if (trigger === 'manual') {
      await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      });
    } else {
      const timer = game.timers();
      await (scenario.timer === 'lock' ? timer.lock : timer.kahoot).fireNow();
    }
    return summarizeEmits(game);
  }

  it.each(SCENARIOS)(
    'delivers the same emits for a timer expiry as for a manual ADVANCE ($name)',
    async (scenario) => {
      const manual = await runTransition(scenario, 'manual');
      const timed = await runTransition(scenario, 'timer');

      expect(timed).toEqual(manual);
    },
  );

  it('delivers presenter context, then the state snapshot, then the team sync when a kahoot lock enters reveal', async () => {
    const emits = await runTransition(
      { name: 'kahoot lock', kahootMode: true, timer: 'lock' },
      'timer',
    );

    expect(emits).toEqual([
      `admin ${SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED}`,
      `display ${SOCKET_EVENTS.STATE_UPDATED} reveal`,
      `admin ${SOCKET_EVENTS.STATE_UPDATED} reveal`,
      `players ${SOCKET_EVENTS.STATE_UPDATED} reveal`,
      `player-0 ${SOCKET_EVENTS.TEAM_ANSWERS_SYNCED} x1`,
    ]);
  });

  it('re-arms the lock timer after a kahoot question timer expiry', async () => {
    const game = await harness.createGateway({
      teamNames: [`Quizzards ${gameCount}`],
      joinCode: nextJoinCode(),
      kahootMode: true,
      settings: {
        kahootQuestionTimerSeconds: TIMER_SECONDS,
        lockGraceSeconds: TIMER_SECONDS,
      },
    });
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);

    await game.timers().kahoot.fireNow();
    expect(game.timers().lock.isArmed()).toBe(true);
    await game.timers().lock.fireNow();

    expect(
      summarizeEmits(game).some((emit) =>
        emit.endsWith(`${SOCKET_EVENTS.STATE_UPDATED} reveal`),
      ),
    ).toBe(true);
  });

  describe('presses that do not go cleanly', () => {
    async function openKahootQuestion() {
      const game = await harness.createGateway({
        teamNames: [`Quizzards ${gameCount}`],
        joinCode: nextJoinCode(),
        kahootMode: true,
        settings: {
          kahootQuestionTimerSeconds: TIMER_SECONDS,
          lockGraceSeconds: TIMER_SECONDS,
        },
      });
      const admin = await game.connectAdmin();
      await game.openFirstQuestion(admin);
      return { game, admin };
    }

    it('leaves the armed deadline armed when a press is refused, and firing it still advances the quiz', async () => {
      const { game, admin } = await openKahootQuestion();
      const dueAt = game.timers().kahoot.dueAt();
      expect(dueAt).not.toBeNull();

      const refused = await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'START_QUIZ',
      });

      expect(refused).toMatchObject({ success: false });
      expect(game.timers().kahoot.dueAt()).toBe(dueAt);
      await game.timers().kahoot.fireNow();
      expect((await game.snapshot()).progress.status).toBe('locking');
    });

    it('leaves the timers matching the stored session when delivering a press throws', async () => {
      const { game, admin } = await openKahootQuestion();
      game.server.emit.mockImplementation(() => {
        throw new Error('socket hiccup');
      });

      await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      });

      // The press was stored: the question has locked, so only the lock
      // deadline is armed and the kahoot question deadline is gone.
      expect(game.timers().kahoot.isArmed()).toBe(false);
      expect(game.timers().lock.isArmed()).toBe(true);
      game.server.emit.mockReset();
      expect((await game.snapshot()).progress.status).toBe('locking');
      await game.timers().lock.fireNow();
      expect((await game.snapshot()).progress.status).toBe('reveal');
    });
  });
});
