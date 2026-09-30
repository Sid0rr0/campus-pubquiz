import { DEFAULT_SESSION_SETTINGS } from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  setupRealStoreGatewayTest,
  type QuizRoundSpec,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const OTHER_QUIZ_ROUNDS: QuizRoundSpec[] = [
  {
    title: 'Imported Round',
    breakAfter: true,
    questions: [
      {
        type: 'free_text',
        prompt: 'Imported question',
        answer: 'Imported answer',
      },
    ],
  },
];

describe('GameGateway — persistence and quiz selection', () => {
  const harness = setupRealStoreGatewayTest();
  let game: RealStoreGateway;

  beforeEach(async () => {
    game = await harness.createGateway({
      rounds: [
        {
          title: 'General Knowledge',
          questions: [
            {
              type: 'multiple_choice',
              prompt: 'Capital of France?',
              answer: 'Paris',
              points: 2,
              payload: { options: ['Paris', 'London', 'Berlin', 'Rome'] },
            },
            {
              type: 'free_text',
              prompt: 'Name the largest planet in the solar system.',
              answer: 'Jupiter',
              points: 2,
            },
          ],
        },
      ],
    });
  });

  /** A second quiz in the same database, for the tests that pick one. Seeded on demand: a restart resumes the newest session, which must stay `game`'s in the tests that restart without it. */
  function seedOtherQuiz(): Promise<RealStoreGateway> {
    return harness.createGateway({
      joinCode: 'OTHER1',
      rounds: OTHER_QUIZ_ROUNDS,
    });
  }

  function createSessionFor(quizId: number) {
    return game.inRequestContext(() => game.gameState.createSession(quizId));
  }

  it('persists progress after applying an action, so a restart resumes it', async () => {
    await game.act('START_QUIZ');

    const restarted = await game.restart();

    expect((await restarted.snapshot()).progress).toEqual({
      status: 'rules',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
      previousStatus: null,
    });
  });

  it('rehydrates progress from the database on init instead of defaulting to lobby', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('ADVANCE'); // -> question 1
    const before = await game.act('ADVANCE'); // -> question 2

    const restarted = await game.restart();

    const snapshot = await restarted.snapshot();
    expect(snapshot.progress).toEqual(before.progress);
    expect(snapshot.progress).toMatchObject({
      status: 'question_open',
      roundIndex: 0,
      questionIndex: 1,
    });
    expect(snapshot.currentQuestion?.id).toBe(game.rounds[0].questionIds[1]);
  });

  it('rehydrates the phase timer’s live frontier from the database on init', async () => {
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro(0)
    await game.act('ADVANCE'); // -> question 1
    const before = await game.act('ADVANCE'); // -> question 2
    expect(before.phaseStartedAt).not.toBeNull();

    const restarted = await game.restart();

    const snapshot = await restarted.snapshot();
    // The currently-displayed question is the restored live frontier, so it
    // shows live — using the *exact* persisted start time, not a fresh one.
    expect(snapshot.phaseStartedAt).toBe(before.phaseStartedAt);
    expect(snapshot.phaseElapsedMs).toBeNull();
  });

  it('exposes the active quiz id', () => {
    expect(game.gameState.getActiveQuizId(game.joinCode)).toBe(game.quizId);
  });

  it('creates a new concurrent session even while the default session has a quiz in progress', async () => {
    const other = await seedOtherQuiz();
    await game.act('START_QUIZ');

    const snapshot = await createSessionFor(other.quizId);

    expect(snapshot.joinCode).not.toBe(game.joinCode);
    expect(snapshot.settings).toEqual(DEFAULT_SESSION_SETTINGS);
    // The original session keeps running untouched by the new one.
    expect((await game.snapshot()).progress.status).toBe('rules');
  });

  it('creates a session after the default game has ended, starting it in the lobby', async () => {
    const other = await seedOtherQuiz();
    await game.act('END_QUIZ');

    const snapshot = await createSessionFor(other.quizId);

    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(snapshot.roundTitles).toEqual(['Imported Round']);
  });

  it('creates a session from the lobby: allocates a new session, loads its rounds, starts fresh', async () => {
    const other = await seedOtherQuiz();
    // The original session has a team on the board; the new one must not.
    const admin = await game.connectAdmin();
    const { socket: team, teamId } = await game.joinTeam('The Quizzards');
    await game.openFirstQuestion(admin);
    await game.gateway.handleSubmitAnswer(asSocket(team), {
      questionId: game.rounds[0].questionIds[0],
      teamId,
      value: 'Paris',
    });
    expect((await game.snapshot()).leaderboard).toEqual([
      expect.objectContaining({ teamId, totalPoints: 2 }),
    ]);

    const snapshot = await createSessionFor(other.quizId);

    expect(snapshot.progress).toEqual({
      status: 'lobby',
      roundIndex: 0,
      questionIndex: 0,
      isLeaderboardVisible: false,
      revealIndex: 0,
      furthestOpenIndex: -1,
    });
    expect(snapshot.roundTitles).toEqual(['Imported Round']);
    expect(snapshot.leaderboard).toEqual([]);
    expect(game.gameState.getActiveQuizId(snapshot.joinCode)).toBe(
      other.quizId,
    );
    expect(game.gameState.getGameSessionId(snapshot.joinCode)).not.toBe(
      game.gameSessionId,
    );
  });

  it('persists later actions under the newly created session', async () => {
    const other = await seedOtherQuiz();
    const created = await createSessionFor(other.quizId);
    const adminForNew = await game.connectAdmin(created.joinCode);

    await game.gateway.handleAdminAction(asSocket(adminForNew), {
      action: 'START_QUIZ',
    });

    // A restart resumes the newest session, so it must have been saved under
    // the new session's id rather than the original's.
    const restarted = await game.restart();
    const snapshot = await restarted.snapshot(created.joinCode);
    expect(snapshot.progress.status).toBe('rules');
  });

  it('drives the game with the newly created session rounds', async () => {
    const other = await seedOtherQuiz();
    const created = await createSessionFor(other.quizId);
    const adminForNew = await game.connectAdmin(created.joinCode);

    await game.gateway.handleAdminAction(asSocket(adminForNew), {
      action: 'START_QUIZ',
    });
    await game.gateway.handleAdminAction(asSocket(adminForNew), {
      action: 'ADVANCE',
    }); // -> round_intro(0)
    await game.gateway.handleAdminAction(asSocket(adminForNew), {
      action: 'ADVANCE',
    });

    const started = await game.snapshot(created.joinCode);
    expect(started.currentQuestion?.id).toBe(other.rounds[0].questionIds[0]);
  });

  it('exposes the new session join code in the snapshot after creating a session', async () => {
    const other = await seedOtherQuiz();
    const snapshot = await createSessionFor(other.quizId);

    expect(snapshot.joinCode).not.toBe(game.joinCode);
    // The code is live: a client connecting with it gets this session.
    expect((await game.snapshot(snapshot.joinCode)).joinCode).toBe(
      snapshot.joinCode,
    );
  });
});
