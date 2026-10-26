import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

import { QuizHasEmptyRoundError } from '@/game/state/errors/quiz-has-empty-round.error';

const START_OF_TIME = '2024-01-01T00:00:00.000Z';
const KAHOOT_TIMER_SECONDS = 30;
const BREAK_END_TIME = Date.parse('2024-01-01T01:00:00.000Z');

describe('GameGateway — a freshly created session', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      kahootMode: true,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    freezeClockAt(START_OF_TIME);
  });

  afterEach(() => {
    restoreClock();
  });

  async function dirtyThenEndTheSession() {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> question_open q0, kahoot deadline armed
    const admin = await game.connectAdmin();
    await game.gateway.handleSetBreakEndTime(asSocket(admin), {
      breakEndsAt: BREAK_END_TIME,
    });
    await game.act('END_QUIZ');
  }

  it('starts in the lobby with no deadlines, no break end time and nothing revealed', async () => {
    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    const snapshot = await game.resync('display', created.joinCode);
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.questionLockAt).toBeNull();
    expect(snapshot.kahootQuestionEndsAt).toBeNull();
    expect(snapshot.screen.kind).toBe('lobby');
    expect(
      (await game.resync('admin', created.joinCode)).breakEndsAt,
    ).toBeNull();
  });

  it('is listed by default, and unlisted when created with listed: false', async () => {
    const byDefault = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );
    const unlisted = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId, {
        ...DEFAULT_SESSION_SETTINGS,
        listed: false,
      }),
    );

    const publicCodes = game.gameState
      .listPublicSessions()
      .map((session) => session.joinCode);
    expect(publicCodes).toContain(byDefault.joinCode);
    expect(publicCodes).not.toContain(unlisted.joinCode);
  });

  it('carries nothing over from the session that came before it', async () => {
    await dirtyThenEndTheSession();

    const created = await game.inRequestContext(() =>
      game.gameState.createSession(game.quizId),
    );

    const snapshot = await game.resync('display', created.joinCode);
    expect(snapshot.progress.status).toBe('lobby');
    expect(snapshot.kahootQuestionEndsAt).toBeNull();
    expect(snapshot.screen.kind).toBe('lobby');
    expect(
      (await game.resync('admin', created.joinCode)).breakEndsAt,
    ).toBeNull();
    const admin = await game.resync('admin', created.joinCode);
    expect(admin.phaseStartedAt).toBeNull();
    expect(admin.phaseElapsedMs).toBeNull();
  });
});

describe('GameGateway — creating a session on a quiz with an empty round', () => {
  const harness = setupRealStoreGatewayTest();

  it('is refused, naming the round, and stores nothing', async () => {
    const unfinished = await harness.createGateway({
      rounds: [
        {
          title: 'Warm-up',
          breakAfter: true,
          questions: [
            {
              type: 'free_text',
              prompt: 'Capital of France?',
              answer: 'Paris',
            },
          ],
        },
        { title: 'Music', questions: [] },
      ],
    });

    const sessionsBefore = unfinished.gameState.listSessions().length;
    await expect(
      unfinished.inRequestContext(() =>
        unfinished.gameState.createSession(unfinished.quizId),
      ),
    ).rejects.toThrow(QuizHasEmptyRoundError);
    await expect(
      unfinished.inRequestContext(() =>
        unfinished.gameState.createSession(unfinished.quizId),
      ),
    ).rejects.toThrow(/Round 2 "Music"/);
    expect(unfinished.gameState.listSessions()).toHaveLength(sessionsBefore);
  });
});
