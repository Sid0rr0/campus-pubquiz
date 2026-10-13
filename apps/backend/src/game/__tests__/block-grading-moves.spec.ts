import { WsException } from '@nestjs/websockets';
import {
  SOCKET_EVENTS,
  SOCKET_ROOMS,
  type AnswersUpdatedPayload,
} from '@campus-pubquiz/types';
import { asSocket } from '@/game/__tests__/test-utils';
import {
  advanceClockBy,
  freezeClockAt,
  restoreClock,
  setupRealStoreGatewayTest,
  type RealStoreGateway,
} from '@/game/__tests__/real-store-test-utils';

/** The answer lists /control was sent for one question since the last clearEmits(). */
function adminAnswerLists(
  game: RealStoreGateway,
  questionId: number,
): AnswersUpdatedPayload[] {
  return game
    .payloadsTo<AnswersUpdatedPayload>(
      SOCKET_ROOMS.ADMIN,
      SOCKET_EVENTS.ANSWERS_UPDATED,
    )
    .filter((payload) => payload.questionId === questionId);
}

/** What a refused move must leave untouched: every answer's stored grade for the questions, plus the progress row on disk. */
async function storedGradingState(
  game: RealStoreGateway,
  questionIds: number[],
) {
  return game.inRequestContext(async () => {
    const answers = await Promise.all(
      questionIds.map((questionId) =>
        game.answerService.listForQuestion(game.gameSessionId, questionId),
      ),
    );
    return {
      answers: answers.flat().map((answer) => ({
        answerId: answer.answerId,
        pointsAwarded: answer.pointsAwarded,
        gradedAt: answer.gradedAt,
      })),
      progress: await game.progressRepository.load(game.gameSessionId),
    };
  });
}

describe('GameGateway — Block grading runs its steps in order for a move', () => {
  const harness = setupRealStoreGatewayTest();

  async function createBlockWithUngradedAnswer() {
    const game = await harness.createGateway({
      teamNames: ['The Quizzards'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Largest planet?', answer: 'Jupiter' },
            {
              type: 'free_text',
              prompt: 'Smallest planet?',
              answer: 'Mercury',
            },
          ],
        },
      ],
    });
    const questionIds = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    const [{ socket, teamId }] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId: questionIds[0],
      teamId,
      value: 'Saturn',
    });
    await game.act('ADVANCE'); // -> second question
    await game.act('ADVANCE'); // -> locking
    const inBreakIntro = await game.act('ADVANCE'); // -> break_intro
    return { game, questionIds, inBreakIntro };
  }

  it('refuses leaving the break for the reveal with an ungraded question and leaves the session as it was', async () => {
    const { game, questionIds } = await createBlockWithUngradedAnswer();
    const [questionId] = questionIds;
    const inBreak = await game.act('PREVIOUS'); // -> break
    expect(inBreak.progress.status).toBe('break');
    expect(inBreak.ungradedQuestionIds).toEqual([questionId]);
    const storedBefore = await storedGradingState(game, questionIds);

    await expect(game.act('ADVANCE')).rejects.toThrow(WsException);

    const after = await game.snapshot();
    expect(after.progress).toEqual(inBreak.progress);
    expect(after.ungradedQuestionIds).toEqual([questionId]);
    expect(await storedGradingState(game, questionIds)).toEqual(storedBefore);
  });

  it('refuses leaving the break intro for the reveal intro with an ungraded question and writes nothing', async () => {
    const { game, questionIds, inBreakIntro } =
      await createBlockWithUngradedAnswer();
    const [questionId] = questionIds;
    expect(inBreakIntro.progress.status).toBe('break_intro');
    expect(inBreakIntro.ungradedQuestionIds).toEqual([questionId]);
    const storedBefore = await storedGradingState(game, questionIds);

    await expect(game.act('ADVANCE')).rejects.toThrow(WsException);

    const after = await game.snapshot();
    expect(after.progress).toEqual(inBreakIntro.progress);
    expect(after.ungradedQuestionIds).toEqual([questionId]);
    expect(await storedGradingState(game, questionIds)).toEqual(storedBefore);
  });

  it('enters a break with a closest_guess question graded, off the ungraded set, and its answer list re-sent', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            { type: 'free_text', prompt: 'Name a fruit', answer: 'Apple' },
            {
              type: 'closest_guess',
              prompt: 'How many students attend?',
              points: 5,
              answer: '1000',
            },
          ],
        },
      ],
    });
    const [freeTextId, closestGuessId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    const [teamA, teamB] = game.teams;
    await game.gateway.handleSubmitAnswer(asSocket(teamA.socket), {
      questionId: freeTextId,
      teamId: teamA.teamId,
      value: 'Pear',
    });
    await game.act('ADVANCE'); // -> closest_guess question
    for (const [team, value] of [
      [teamA, '900'],
      [teamB, '2000'],
    ] as const) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId: closestGuessId,
        teamId: team.teamId,
        value,
      });
    }
    await game.act('ADVANCE'); // -> locking
    game.clearEmits();

    const inBreak = await game.act('ADVANCE'); // -> break_intro

    expect(inBreak.progress.status).toBe('break_intro');
    expect(inBreak.ungradedQuestionIds).toEqual([freeTextId]);
    const lists = adminAnswerLists(game, closestGuessId);
    expect(lists).toHaveLength(1);
    expect(lists[0].answers.every((answer) => answer.gradedAt !== null)).toBe(
      true,
    );
  });

  it('restores the ungraded set and the closest_guess summary after a restart in the break without changing any stored points', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A', 'Team B'],
      rounds: [
        {
          title: 'Round 1',
          breakAfter: true,
          questions: [
            {
              type: 'closest_guess',
              prompt: 'How many students attend?',
              points: 5,
              answer: '1000',
            },
            { type: 'free_text', prompt: 'Name a fruit', answer: 'Apple' },
          ],
        },
      ],
    });
    const [closestGuessId, freeTextId] = game.rounds[0].questionIds;
    const admin = await game.connectAdmin();
    await game.openFirstQuestion(admin);
    const [teamA, teamB] = game.teams;
    for (const [team, value] of [
      [teamA, '900'],
      [teamB, '2000'],
    ] as const) {
      await game.gateway.handleSubmitAnswer(asSocket(team.socket), {
        questionId: closestGuessId,
        teamId: team.teamId,
        value,
      });
    }
    await game.act('ADVANCE'); // -> free_text question
    await game.gateway.handleSubmitAnswer(asSocket(teamA.socket), {
      questionId: freeTextId,
      teamId: teamA.teamId,
      value: 'Pear',
    });
    await game.act('ADVANCE'); // -> locking
    await game.act('ADVANCE'); // -> break_intro, closest_guess graded
    const inBreak = await game.act('PREVIOUS'); // -> break
    const storedPoints = (g: RealStoreGateway, questionId: number) =>
      g.inRequestContext(async () =>
        (await g.answerService.listForQuestion(g.gameSessionId, questionId))
          .map((answer) => [answer.teamName, answer.pointsAwarded])
          .sort(),
      );
    const pointsBefore = await storedPoints(game, closestGuessId);

    const restarted = await game.restart();
    const afterRestart = await restarted.snapshot();

    expect(afterRestart.progress.status).toBe('break');
    expect(afterRestart.ungradedQuestionIds).toEqual(
      inBreak.ungradedQuestionIds,
    );
    expect(afterRestart.ungradedQuestionIds).toEqual([freeTextId]);
    expect(await storedPoints(restarted, closestGuessId)).toEqual(pointsBefore);
    expect(pointsBefore).toEqual([
      ['Team A', 5],
      ['Team B', 0],
    ]);

    const [pearAnswer] = await restarted.inRequestContext(() =>
      restarted.answerService.listForQuestion(
        restarted.gameSessionId,
        freeTextId,
      ),
    );
    await restarted.gateway.handleGradeAnswer(
      asSocket(await restarted.connectAdmin()),
      { answerId: pearAnswer.answerId, pointsAwarded: 0 },
    );
    await restarted.act('ADVANCE'); // -> reveal_intro
    const atReveal = await restarted.act('ADVANCE'); // -> reveal
    expect(atReveal.revealQuestions[0].closestGuess).toEqual({
      hasSubmissions: true,
      minGuess: '900',
      maxGuess: '2000',
      closestGuesses: [{ teamName: 'Team A', value: '900' }],
    });
    expect(await storedPoints(restarted, closestGuessId)).toEqual(pointsBefore);
  });
});

const KAHOOT_ANSWER_DELAY_MS = 5_000;

describe('GameGateway — kahoot speed scoring when a question leaves locking', () => {
  const harness = setupRealStoreGatewayTest();

  beforeEach(() => {
    freezeClockAt('2024-01-01T00:00:00.000Z');
  });

  afterEach(() => {
    restoreClock();
  });

  // Scenario choice: a kahoot round leaves 'locking' straight for 'reveal' and
  // never takes a break in between, so the reveal follows the speed scoring
  // directly. This pins that the scoring runs on that move and its points
  // reach the leaderboard and the ungraded set; it does not pin the ordering
  // against the other steps, which have nothing to do for this question.
  it('scales the points by answer speed and puts them on the leaderboard with a correct ungraded set', async () => {
    const game = await harness.createGateway({
      teamNames: ['Team A'],
      rounds: [
        {
          title: 'Speed Round',
          kahootMode: true,
          breakAfter: true,
          questions: [
            {
              type: 'multiple_choice',
              prompt: 'Capital of France?',
              answer: 'Paris',
              points: 10,
              payload: { options: ['Paris', 'London'] },
            },
          ],
        },
      ],
      settings: { kahootQuestionTimerSeconds: 10 },
    });
    const [questionId] = game.rounds[0].questionIds;
    await game.openFirstQuestion(await game.connectAdmin());
    const [{ socket, teamId }] = game.teams;
    advanceClockBy(KAHOOT_ANSWER_DELAY_MS);
    await game.gateway.handleSubmitAnswer(asSocket(socket), {
      questionId,
      teamId,
      value: 'Paris',
    });
    await game.act('ADVANCE'); // -> locking
    const revealed = await game.act('ADVANCE'); // leaves locking, speed-scored

    const [stored] = await game.inRequestContext(() =>
      game.answerService.listForQuestion(game.gameSessionId, questionId),
    );
    expect(stored.pointsAwarded).toBeGreaterThan(0);
    expect(stored.pointsAwarded).toBeLessThan(10);
    expect(revealed.leaderboard).toEqual([
      expect.objectContaining({ totalPoints: stored.pointsAwarded }),
    ]);
    expect(revealed.ungradedQuestionIds).toEqual([]);
  });
});
