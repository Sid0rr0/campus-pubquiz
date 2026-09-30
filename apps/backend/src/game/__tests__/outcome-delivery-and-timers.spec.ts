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

const TIMER_SECONDS = 1;
const LONG_SECONDS = 60;
const TIMER_WAIT_MS = 10_000;
const POLL_INTERVAL_MS = 25;

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

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

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

  async function waitFor(
    isDone: () => boolean,
    failure: string,
  ): Promise<void> {
    const deadline = Date.now() + TIMER_WAIT_MS;
    while (!isDone()) {
      if (Date.now() > deadline) {
        throw new Error(failure);
      }
      await delay(POLL_INTERVAL_MS);
    }
  }

  async function advanceToLocking(
    game: RealStoreGateway,
    admin: MockSocket,
    isKahoot: boolean,
  ): Promise<void> {
    // A kahoot question locks straight from its first question; a normal
    // round only locks after its last one (multiple_choice, free_text,
    // closest_guess, match).
    const advances = isKahoot ? 1 : 4;
    for (let index = 0; index < advances; index++) {
      await game.gateway.handleAdminAction(asSocket(admin), {
        action: 'ADVANCE',
      });
    }
  }

  /**
   * Plays a question up to the point right before the next automatic
   * transition, then produces that transition either by the admin pressing
   * ADVANCE or by waiting for the timer. Returns every emit it produced.
   */
  async function runTransition(
    scenario: Scenario,
    trigger: Trigger,
    expectedEmitCount = 1,
  ): Promise<string[]> {
    const isTimerRun = trigger === 'timer';
    const settings: Partial<SessionSettings> = {
      lockGraceSeconds:
        isTimerRun && scenario.timer === 'lock' ? TIMER_SECONDS : LONG_SECONDS,
      kahootQuestionTimerSeconds:
        scenario.timer === 'kahootQuestion'
          ? isTimerRun
            ? TIMER_SECONDS * 2
            : LONG_SECONDS
          : null,
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
      await waitFor(
        () => game.roomEmits().length >= expectedEmitCount,
        `Timed out waiting for ${expectedEmitCount} emits; got ${game.roomEmits().length}`,
      );
    }
    const emits = summarizeEmits(game);
    game.gateway.onModuleDestroy();
    return emits;
  }

  it.each(SCENARIOS)(
    'delivers the same emits for a timer expiry as for a manual ADVANCE ($name)',
    async (scenario) => {
      const manual = await runTransition(scenario, 'manual');
      const timed = await runTransition(scenario, 'timer', manual.length);

      expect(timed).toEqual(manual);
    },
    3 * TIMER_WAIT_MS,
  );

  it(
    'delivers presenter context, then the state snapshot, then the team sync when a kahoot lock enters reveal',
    async () => {
      const emits = await runTransition(
        { name: 'kahoot lock', kahootMode: true, timer: 'lock' },
        'timer',
        3,
      );

      expect(emits).toEqual([
        `admin ${SOCKET_EVENTS.PRESENTER_CONTEXT_UPDATED}`,
        `display+admin+players ${SOCKET_EVENTS.STATE_UPDATED} reveal`,
        `player-0 ${SOCKET_EVENTS.TEAM_ANSWERS_SYNCED} x1`,
      ]);
    },
    2 * TIMER_WAIT_MS,
  );

  it(
    're-arms the lock timer after a kahoot question timer expiry',
    async () => {
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

      await waitFor(
        () =>
          summarizeEmits(game).some((emit) =>
            emit.endsWith(`${SOCKET_EVENTS.STATE_UPDATED} reveal`),
          ),
        'Kahoot question never reached reveal by timers alone',
      );
      game.gateway.onModuleDestroy();
    },
    2 * TIMER_WAIT_MS,
  );
});
