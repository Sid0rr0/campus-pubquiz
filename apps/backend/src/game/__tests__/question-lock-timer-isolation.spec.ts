import {
  DEFAULT_SESSION_SETTINGS,
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  sessionRoom,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const LOCK_GRACE_SECONDS = 1;
const PAST_LOCK_GRACE_MS = 1_800;

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

describe('GameGateway — concurrent sessions: question-lock timer isolation', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    // One single-question breakAfter round, so a session reaches the locking
    // countdown with one ADVANCE from its open question; the short grace
    // stands in for the 60s default so the timer fires within the test.
    game = await harness.createGateway({
      settings: { lockGraceSeconds: LOCK_GRACE_SECONDS },
      rounds: [
        {
          title: 'Round Alpha',
          breakAfter: true,
          questions: [{ type: 'free_text', prompt: 'QA', answer: 'Answer A' }],
        },
      ],
    });
  });

  it('arms independent question-lock timers per session; cancelling one never disturbs the other', async () => {
    const adminA = await game.connectAdmin();
    await game.openFirstQuestion(adminA);
    const { joinCode: joinCodeB } = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId, {
        ...DEFAULT_SESSION_SETTINGS,
        lockGraceSeconds: LOCK_GRACE_SECONDS,
      }),
    );
    const adminB = await game.connectAdmin(joinCodeB);
    await game.openFirstQuestion(adminB);

    await game.gateway.handleAdminAction(asSocket(adminA), {
      action: 'ADVANCE',
    }); // A -> locking
    await game.gateway.handleAdminAction(asSocket(adminB), {
      action: 'ADVANCE',
    }); // B -> locking
    await game.gateway.handleAdminAction(asSocket(adminB), {
      action: 'PREVIOUS',
    }); // cancels B's timer only
    game.clearEmits();

    await delay(PAST_LOCK_GRACE_MS);

    expect((await game.snapshot()).progress.status).toBe('break_intro');
    expect((await game.snapshot(joinCodeB)).progress.status).toBe(
      'question_open',
    );
    const displayA = game.payloadsTo<StateSnapshotPayload>(
      SOCKET_ROOMS.DISPLAY,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    expect(displayA).toEqual([
      expect.objectContaining({
        joinCode: game.joinCode,
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment -- nested expect.objectContaining resolves to `any` in @types/jest
        progress: expect.objectContaining({ status: 'break_intro' }),
      }),
    ]);
    expect(game.roomEmits().flatMap(({ rooms }) => rooms)).not.toContain(
      sessionRoom(joinCodeB, SOCKET_ROOMS.DISPLAY),
    );
  });
});
