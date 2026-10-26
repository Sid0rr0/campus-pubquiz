import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type StateSnapshotPayload,
} from '@campus-pubquiz/types';
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
      {
        type: 'free_text',
        prompt: 'Name that tune',
        answer: 'Queen',
        points: 2,
        payload: { mediaUrl: 'https://example.com/tune.mp3' },
      },
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

const NUMBER_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Estimation',
    breakAfter: true,
    questions: [
      {
        type: 'number',
        prompt: 'How many bones?',
        answer: '100',
        points: 3,
        payload: { margin: { value: 10, unit: 'percent' } },
      },
    ],
  },
];

/** A match question as CSV import leaves it (no stored scoring mode), with a later round to edit. */
const MATCH_QUIZ: CreateGatewayOptions['rounds'] = [
  {
    title: 'Capitals',
    breakAfter: true,
    questions: [
      {
        type: 'match',
        prompt: 'Match countries to capitals',
        answer: 'Paris|Rome',
        points: 4,
        payload: {
          options: ['France', 'Italy'],
          matchTargets: ['Rome', 'Paris'],
        },
      },
    ],
  },
  {
    title: 'Later',
    breakAfter: true,
    questions: [
      {
        type: 'free_text',
        prompt: 'Largest planet?',
        answer: 'Jupiter',
        points: 1,
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
    await game.saveAnswerKeyFix(game.questionIds.freeText, {
      answer: 'Saturn',
    });

    expect(await storedPoints(game, game.questionIds.freeText)).toEqual({
      'Saturn Fans': 2,
    });
    expect(lastAdminLeaderboard(game)).toEqual([
      expect.objectContaining({ teamId: team.teamId, totalPoints: 2 }),
    ]);
  });

  it('grades a newly matching audio answer on a key fix and keeps the moderator grades', async () => {
    const { game, admin } = await start({
      teamNames: ['Tune Team', 'Abba Fan', 'Moderated'],
      rounds: AUDIO_QUIZ,
    });
    const [tune, abba, moderated] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, tune, questionId, 'Queen'); // auto-graded under the old key
    await submit(game, abba, questionId, 'Abba'); // waits for the moderator
    await submit(game, moderated, questionId, 'Bowie');
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    const moderatedAnswer = answers.find((a) => a.teamName === 'Moderated')!;
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: moderatedAnswer.answerId,
      pointsAwarded: 1,
    });
    expect(await storedPoints(game, questionId)).toEqual({
      'Tune Team': 2,
      'Abba Fan': 0,
      Moderated: 1,
    });
    await game.saveAnswerKeyFix(questionId, { answer: 'Abba', points: 5 });

    expect(await storedPoints(game, questionId)).toEqual({
      'Tune Team': 0, // no longer matches: back to ungraded
      'Abba Fan': 5, // now matches
      Moderated: 1, // the moderator's grade survives
    });
    const after = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(
      Object.fromEntries(after.map((a) => [a.teamName, a.gradedAt !== null])),
    ).toEqual({ 'Tune Team': false, 'Abba Fan': true, Moderated: true });
  });

  it('re-applies the speed scaling from the stored response time after a kahoot question was scored', async () => {
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
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 7.5 });
    await game.saveAnswerKeyFix(questionId, { points: 20 });

    // 20 points at the stored response time's x0.75 multiplier, not the unscaled 20.
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 15 });
  });

  it('speed-scales a correction made before the kahoot question locks, and keeps it through lock', async () => {
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
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 10 });
    await game.saveAnswerKeyFix(questionId, { points: 20 });

    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 15 });
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> reveal (speed-scored at lock)
    expect(await storedPoints(game, questionId)).toEqual({ Speedy: 15 });
  });

  it('re-scores a number question when its margin is widened, discarding a manual override', async () => {
    const { game, admin } = await start({
      teamNames: ['Near', 'Far'],
      rounds: NUMBER_QUIZ,
    });
    const [near, far] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, near, questionId, '105'); // inside the stored 10%
    await submit(game, far, questionId, '130'); // outside it
    const answers = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    const farAnswer = answers.find((a) => a.teamName === 'Far')!;
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: farAnswer.answerId,
      pointsAwarded: 1,
    });
    expect(await storedPoints(game, questionId)).toEqual({ Near: 3, Far: 1 });
    await game.saveAnswerKeyFix(questionId, {
      margin: { value: 5, unit: 'absolute' },
    });

    expect(await storedPoints(game, questionId)).toEqual({ Near: 3, Far: 0 });
    await game.saveAnswerKeyFix(questionId, {
      margin: { value: 30, unit: 'percent' },
    });

    expect(await storedPoints(game, questionId)).toEqual({ Near: 3, Far: 3 });
  });

  it('re-scores a sort question when its scoring mode changes', async () => {
    const { game, admin } = await start({
      teamNames: ['Shuffler'],
      rounds: [
        {
          title: 'Order',
          breakAfter: true,
          questions: [
            {
              type: 'sort',
              prompt: 'Order them',
              answer: 'a|b|c|d',
              points: 8,
              payload: { options: ['d', 'c', 'b', 'a'] },
            },
          ],
        },
      ],
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, team, questionId, 'a|b|d|c');
    expect(await storedPoints(game, questionId)).toEqual({ Shuffler: 4 });

    await game.saveAnswerKeyFix(questionId, { scoringMode: 'exact' });
    expect(await storedPoints(game, questionId)).toEqual({ Shuffler: 0 });

    await game.saveAnswerKeyFix(questionId, { scoringMode: 'per_item' });
    expect(await storedPoints(game, questionId)).toEqual({ Shuffler: 4 });

    await game.saveAnswerKeyFix(questionId, { scoringMode: 'one_off' });
    expect(await storedPoints(game, questionId)).toEqual({ Shuffler: 4 });
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
    await game.saveAnswerKeyFix(questionId, { answer: '400' });

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
    await game.saveAnswerKeyFix(questionId, { answer: '650' });

    expect(await storedPoints(game, questionId)).toEqual({ Near: 0, Far: 3 });
    await game.act('ADVANCE'); // -> reveal_intro
    const [revealed] = (await game.act('ADVANCE')).revealQuestions; // -> reveal
    expect(revealed).toEqual(
      expect.objectContaining({
        id: questionId,
        closestGuess: {
          hasSubmissions: true,
          minGuess: '480',
          maxGuess: '650',
          closestGuesses: [{ teamName: 'Far', value: '650' }],
        },
      }),
    );
  });

  it('keeps a moderator override on an opened CSV-shaped match question when only a later round is saved', async () => {
    const { game, admin } = await start({
      teamNames: ['Pairs'],
      rounds: MATCH_QUIZ,
    });
    const [team] = game.teams;
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(admin);
    await submit(game, team, questionId, 'Paris|Milan'); // one pair right: half of 4
    const [answer] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    await game.gateway.handleGradeAnswer(asSocket(admin), {
      answerId: answer.answerId,
      pointsAwarded: 3,
    });
    expect(await storedPoints(game, questionId)).toEqual({ Pairs: 3 });
    const leaderboardBefore = lastAdminLeaderboard(game);
    game.clearEmits();

    // The editor always saves the scoring mode explicitly; only round 2 changes.
    await game.saveQuizEdit((rounds) =>
      rounds.map((round, roundIndex) => ({
        ...round,
        questions: round.questions.map((question) =>
          roundIndex === 0
            ? { ...question, scoringMode: 'per_item' as const }
            : { ...question, prompt: 'Which planet is largest?' },
        ),
      })),
    );

    expect(await storedPoints(game, questionId)).toEqual({ Pairs: 3 });
    const events = game.roomEmits().map((emit) => emit.event);
    expect(events).not.toContain(SOCKET_EVENTS.ANSWERS_UPDATED);
    expect(events).not.toContain(SOCKET_EVENTS.TEAM_ANSWERS_SYNCED);
    expect(lastAdminLeaderboard(game)).toEqual(leaderboardBefore);
  });
});
