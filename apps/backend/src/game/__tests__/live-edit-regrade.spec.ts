import { RequestContext } from '@mikro-orm/postgresql';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
import { Question } from '@/db/entities/question.entity';
import { asSocket, type MockSocket } from '@/game/__tests__/test-utils';
import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type CreateGatewayOptions,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

const KAHOOT_TIMER_SECONDS = 10;
const HALF_TIMER_MS = (KAHOOT_TIMER_SECONDS * 1000) / 2;
const FROZEN_NOW = '2024-01-01T00:00:00.000Z';

const AUDIO_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Round 1',
    breakAfter: true,
    questions: [
      { type: 'audio', prompt: 'Name that tune', answer: 'Queen', points: 2 },
    ],
  },
];

const CLOSEST_GUESS_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Estimation',
    breakAfter: true,
    questions: [
      {
        type: 'closest_guess',
        prompt: 'How many jelly beans?',
        answer: '500',
        points: 3,
      },
    ],
  },
];

const KAHOOT_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Speed Round',
    kahootMode: true,
    questions: [
      {
        type: 'multiple_choice',
        prompt: 'Capital of France?',
        answer: 'Paris',
        points: 10,
        payload: { options: ['Paris', 'London'] },
      },
      {
        type: 'multiple_choice',
        prompt: 'Capital of Italy?',
        answer: 'Rome',
        points: 10,
        payload: { options: ['Rome', 'Milan'] },
      },
    ],
  },
];

describe('GameGateway — live answer-key fix regrades by question type', () => {
  const harness = setupRealStoreGatewayTest();

  afterEach(() => {
    restoreClock();
  });

  async function start(
    options: CreateGatewayOptions,
  ): Promise<{ game: RealStoreGateway; admin: MockSocket }> {
    const game = await harness.createGateway(options);
    return { game, admin: await game.connectAdmin() };
  }

  function submit(
    game: RealStoreGateway,
    team: { socket: MockSocket; teamId: number },
    questionId: number,
    value: string,
  ) {
    return game.gateway.handleSubmitAnswer(asSocket(team.socket), {
      questionId,
      teamId: team.teamId,
      value,
    });
  }

  function storedPoints(game: RealStoreGateway, questionId: number) {
    return game.inRequestContext(async () => {
      const answers = await game.answerService.listForQuestion(
        game.gameSessionId,
        questionId,
      );
      return Object.fromEntries(
        answers.map((answer) => [answer.teamName, answer.pointsAwarded]),
      );
    });
  }

  async function correctAnswerKey(
    game: RealStoreGateway,
    questionId: number,
    fix: { answer?: string; points?: number },
  ) {
    await game.inRequestContext(async () => {
      const em = RequestContext.getEntityManager()!;
      const question = await em.findOneOrFail(Question, { id: questionId });
      question.answer = fix.answer ?? question.answer;
      question.points = fix.points ?? question.points;
      await em.flush();
    });
  }

  // QuizController.update calls notifyQuizEdited inside an HTTP request context.
  function editQuiz(game: RealStoreGateway, regradeQuestionIds: number[]) {
    return game.inRequestContext(() =>
      game.gateway.notifyQuizEdited(game.joinCode, regradeQuestionIds),
    );
  }

  function lastAdminLeaderboard(game: RealStoreGateway) {
    const snapshots = game.payloadsTo<StateSnapshotPayload>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.STATE_UPDATED,
    );
    return snapshots[snapshots.length - 1].leaderboard;
  }

  it('re-scores a free_text question against the reloaded answer key and refreshes the leaderboard', async () => {
    const { game } = await start({ teamNames: ['Saturn Fans'] });
    const [team] = game.teams;
    await game.act('START_QUIZ');
    await game.act('ADVANCE'); // -> round_intro
    await game.act('ADVANCE'); // -> multiple_choice
    await game.act('ADVANCE'); // -> free_text
    await submit(game, team, game.questionIds.freeText, 'Saturn');
    expect(await storedPoints(game, game.questionIds.freeText)).toEqual({
      'Saturn Fans': 0,
    });
    await correctAnswerKey(game, game.questionIds.freeText, {
      answer: 'Saturn',
    });

    await editQuiz(game, [game.questionIds.freeText]);

    expect(await storedPoints(game, game.questionIds.freeText)).toEqual({
      'Saturn Fans': 2,
    });
    expect(lastAdminLeaderboard(game)).toEqual([
      expect.objectContaining({ teamId: team.teamId, totalPoints: 2 }),
    ]);
  });

  it('leaves a human-graded question alone, without touching the leaderboard', async () => {
    const { game, admin } = await start({
      teamNames: ['Tune Team'],
      rounds: AUDIO_QUIZ,
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, team, questionId, 'Queen');
    const [{ answerId }] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId,
      pointsAwarded: 1,
    });
    await correctAnswerKey(game, questionId, { answer: 'Abba', points: 5 });
    game.clearEmits();

    await editQuiz(game, [questionId]);

    expect(await storedPoints(game, questionId)).toEqual({ 'Tune Team': 1 });
    expect(
      game
        .payloadsTo(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED)
        .concat(
          game.payloadsTo(
            SOCKET_ROOMS.ADMIN,
            SOCKET_EVENTS.TEAM_ANSWERS_SYNCED,
          ),
        ),
    ).toEqual([]);
  });

  it('re-applies the speed multipliers recorded when a kahoot question was scored', async () => {
    freezeClockAt(FROZEN_NOW);
    const { game, admin } = await start({
      teamNames: ['Speedy'],
      rounds: KAHOOT_QUIZ,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    advanceClockBy(HALF_TIMER_MS); // answers halfway through the timer: x0.75
    await submit(game, team, questionId, 'Paris');
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal (speed-scored)
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 8 });
    await correctAnswerKey(game, questionId, { points: 20 });

    await editQuiz(game, [questionId]);

    // 20 points at the recorded x0.75 multiplier, not the unscaled 20.
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 15 });
  });

  it('leaves a kahoot question that has not been speed-scored yet to the scoring at lock', async () => {
    const { game, admin } = await start({
      teamNames: ['Speedy'],
      rounds: KAHOOT_QUIZ,
      settings: { kahootQuestionTimerSeconds: KAHOOT_TIMER_SECONDS },
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, team, questionId, 'Paris');
    const pointsBefore = await storedPoints(game, questionId);
    await correctAnswerKey(game, questionId, { answer: 'London' });
    game.clearEmits();

    await editQuiz(game, [questionId]);

    expect(await storedPoints(game, questionId)).toEqual(pointsBefore);
    expect(
      game.payloadsTo(SOCKET_ROOMS.ADMIN, SOCKET_EVENTS.ANSWERS_UPDATED),
    ).toEqual([]);
  });

  it('skips a closest_guess question that has not been graded yet', async () => {
    const { game, admin } = await start({
      teamNames: ['Guesser'],
      rounds: CLOSEST_GUESS_QUIZ,
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, team, questionId, '400');
    await correctAnswerKey(game, questionId, { answer: '400' });

    await editQuiz(game, [questionId]);

    expect(await storedPoints(game, questionId)).toEqual({ Guesser: 0 });
  });

  it('re-runs closest_guess batch grading with the corrected target once it has been graded', async () => {
    const { game, admin } = await start({
      teamNames: ['Near', 'Far'],
      rounds: CLOSEST_GUESS_QUIZ,
    });
    const [near, far] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, near, questionId, '480');
    await submit(game, far, questionId, '650');
    await game.act('ADVANCE'); // -> locking, where closest_guess is graded
    await game.act('ADVANCE'); // -> break_intro
    expect(await storedPoints(game, questionId)).toEqual({ Near: 3, Far: 0 });
    await correctAnswerKey(game, questionId, { answer: '650' });

    await editQuiz(game, [questionId]);

    expect(await storedPoints(game, questionId)).toEqual({ Near: 0, Far: 3 });
  });
});
